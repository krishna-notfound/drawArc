// @vitest-environment node
import { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createClerkWebhookRoute } from '@/lib/clerk-webhook';
import type { PrismaClient } from '@/lib/generated/prisma/client';
import type { UserDb } from '@/lib/users';
import { createFakeLogger } from '@/tests/helpers/fake-logger';
import { createFakeUserDb } from '@/tests/helpers/fake-user-db';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';

// A locally generated Svix secret: signatures are produced by the `svix` library (the format Clerk sends)
// and verified by the real `verifyWebhook` from @clerk/nextjs/webhooks.
const SECRET = `whsec_${Buffer.from('drawarc-f02-test-signing-secret').toString('base64')}`;
const WRONG_SECRET = `whsec_${Buffer.from('some-other-signing-secret-value').toString('base64')}`;
const INVALID_SIGNATURE = { error: { code: 'VALIDATION', message: 'Invalid webhook signature', requestId: expect.any(String) } };

function userPayload(id: string, email: string, firstName = 'Ada') {
  return JSON.stringify({
    type: 'user.created',
    object: 'event',
    data: {
      id,
      email_addresses: [{ id: 'e1', email_address: email }],
      primary_email_address_id: 'e1',
      first_name: firstName,
      last_name: null,
      username: null,
      image_url: 'https://img.clerk.com/ada',
    },
  });
}

function signedHeaders(body: string, secret = SECRET, msgId = `msg_${crypto.randomUUID()}`): Record<string, string> {
  const timestamp = new Date();
  return {
    'svix-id': msgId,
    'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'svix-signature': new Webhook(secret).sign(msgId, timestamp, body),
  };
}

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** Wraps a db so every `user.*` call is counted: signature failures must reach zero of them. */
function counting(db: UserDb) {
  let calls = 0;
  const user = new Proxy(db.user, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls += 1;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { db: { user } as UserDb, calls: () => calls };
}

function route(db: UserDb, logger = createFakeLogger()) {
  return {
    logger,
    POST: createClerkWebhookRoute({ db, logger, signingSecret: SECRET, bindPendingMemberships: async () => ({ bound: 0 }), removeMemberships: async () => ({ removed: 0 }) }),
  };
}

describe('POST /api/webhooks/clerk — signature gate (AC-020, AUTHZ-MATRIX)', () => {
  const body = userPayload('user_clerk_sig', 'sig@example.com');

  it.each([
    ['no svix headers (a Clerk session cookie is no substitute)', () => post(body, { cookie: '__session=abc' })],
    ['a signature made with the wrong secret', () => post(body, signedHeaders(body, WRONG_SECRET))],
    ['a valid header set over a tampered body', () => post(body.replace('Ada', 'Eve'), signedHeaders(body))],
    ['a signature whose svix-id was swapped', () => post(body, { ...signedHeaders(body), 'svix-id': 'msg_other' })],
  ])('answers 400 with no database access for %s', async (_label, request) => {
    const fake = createFakeUserDb();
    const spy = counting(fake.db);
    const res = await route(spy.db).POST(request());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(INVALID_SIGNATURE);
    expect(spy.calls()).toBe(0);
    expect(fake.rows()).toHaveLength(0);
  });

  it('exports only POST, so Next answers 405 to GET/PUT/DELETE', async () => {
    const mod = await import('@/app/api/webhooks/clerk/route');
    expect(Object.keys(mod)).toEqual(['POST']);
  });

  it('answers 502 UPSTREAM when the database fails, so Svix retries (EC-008)', async () => {
    const down = new Error('connect ECONNREFUSED');
    const broken = { user: { upsert: vi.fn().mockRejectedValue(down), findUnique: vi.fn().mockRejectedValue(down) } };
    const { POST, logger } = route(broken as unknown as UserDb);
    const res = await POST(post(body, signedHeaders(body)));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'UPSTREAM' } });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe.skipIf(!hasTestDatabase)('POST /api/webhooks/clerk against Postgres (AC-023, AUTHZ-MATRIX)', { timeout: 60_000 }, () => {
  const PREFIX = 'l2_webhook_';
  let db: PrismaClient;
  const cleanup = () => db.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    await cleanup();
  }, 120_000);

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it('applies a validly signed user.created once, even when Svix redelivers it', async () => {
    const body = userPayload(`${PREFIX}a`, `${PREFIX}A@Example.com`);
    const headers = signedHeaders(body);
    for (let delivery = 0; delivery < 2; delivery += 1) {
      const res = await route(db).POST(post(body, headers));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, handled: true });
    }
    const rows = await db.user.findMany({ where: { clerkId: `${PREFIX}a` } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: `${PREFIX}a@example.com`, name: 'Ada', deletedAt: null });
  });

  it('answers 200 email-conflict and logs both Clerk ids when the email belongs to another user (EC-007)', async () => {
    const email = `${PREFIX}shared@example.com`;
    await db.user.create({ data: { clerkId: `${PREFIX}owner`, email } });
    const body = userPayload(`${PREFIX}intruder`, email);
    const { POST, logger } = route(db);

    const res = await POST(post(body, signedHeaders(body)));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, handled: false, reason: 'email-conflict' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: `${PREFIX}intruder`, conflictingClerkId: `${PREFIX}owner` }),
      expect.any(String),
    );
    expect(await db.user.count({ where: { clerkId: `${PREFIX}intruder` } })).toBe(0);
  });
});
