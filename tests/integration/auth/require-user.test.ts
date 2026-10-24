// @vitest-environment node
import type { WebhookEvent } from '@clerk/nextjs/webhooks';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRequireUser } from '@/lib/auth';
import { handleClerkEvent } from '@/lib/clerk-webhook';
import type { PrismaClient } from '@/lib/generated/prisma/client';
import { type BackendUserLike, EmailHeldError, markUserDeleted, upsertUserFromClerk } from '@/lib/users';
import { makeUser } from '@/tests/factories';
import { createFakeLogger } from '@/tests/helpers/fake-logger';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase, testSchema } from '@/tests/integration/db';

// Rows of this file carry this prefix so parallel L2 files never touch each other's data.
const PREFIX = 'l2_require_user_';

describe.skipIf(!hasTestDatabase)('User sync against Postgres (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;

  const cleanup = () => db.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    await cleanup();
  }, 120_000);

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it('migration 1 created exactly the User table with unique clerkId and email (AC-012)', async () => {
    const migrations = await db.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM "${testSchema}"."_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );
    expect(migrations.map((m) => m.migration_name)).toEqual([expect.stringMatching(/^\d{14}_user$/)]);

    const columns = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name::text AS column_name FROM information_schema.columns
      WHERE table_schema = ${testSchema} AND table_name = 'User' ORDER BY ordinal_position`;
    expect(columns.map((c) => c.column_name)).toEqual([
      'id',
      'clerkId',
      'email',
      'name',
      'avatarUrl',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);

    const uniques = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE schemaname = ${testSchema} AND tablename = 'User' AND indexdef LIKE 'CREATE UNIQUE%'`;
    const defs = uniques.map((u) => u.indexdef).join('\n');
    expect(defs).toContain('("clerkId")');
    expect(defs).toContain('(email)');
  });

  it('upserts idempotently by clerkId and marks deletions (AC-019)', async () => {
    const input = { clerkId: `${PREFIX}idem`, email: `${PREFIX}idem@example.com`, name: 'Ada', avatarUrl: null };
    const first = await upsertUserFromClerk(db, input);
    const second = await upsertUserFromClerk(db, input);
    expect(second.id).toBe(first.id);
    const renamed = await upsertUserFromClerk(db, { ...input, name: 'Ada Lovelace' });
    expect(renamed).toMatchObject({ id: first.id, name: 'Ada Lovelace' });
    expect(await db.user.count({ where: { clerkId: input.clerkId } })).toBe(1);

    expect(await markUserDeleted(db, input.clerkId)).toBe('marked');
    expect((await db.user.findUniqueOrThrow({ where: { clerkId: input.clerkId } })).deletedAt).toBeInstanceOf(Date);
    // FR-018 supersedes "missing writes nothing": an unknown clerkId gets a tombstone (AC-036 below).
    expect(await markUserDeleted(db, `${PREFIX}missing`)).toBe('tombstoned');
    expect(await db.user.count({ where: { clerkId: `${PREFIX}missing`, deletedAt: { not: null } } })).toBe(1);
  });

  function requireUserFor(backendUser: BackendUserLike, now?: Date) {
    const bindPendingMemberships = vi.fn(async () => ({ bound: 0 }));
    const requireUser = createRequireUser({
      auth: async () => ({ userId: backendUser.id }),
      currentUser: async () => backendUser,
      db,
      bindPendingMemberships,
      redirect: (url: string): never => {
        throw new Error(`unexpected redirect to ${url}`);
      },
      logger: createFakeLogger(),
      ...(now ? { now: () => now } : {}),
    });
    return { requireUser, bindPendingMemberships };
  }

  it('five concurrent first requests create exactly one row (AC-016, EC-001)', async () => {
    const clerkId = `${PREFIX}concurrent`;
    const { requireUser, bindPendingMemberships } = requireUserFor({
      id: clerkId,
      firstName: 'Grace',
      lastName: 'Hopper',
      username: null,
      imageUrl: 'https://img.clerk.com/grace',
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: `${PREFIX}Grace@Example.COM` }],
    });

    const results = await Promise.all(Array.from({ length: 5 }, () => requireUser()));

    expect(await db.user.count({ where: { clerkId } })).toBe(1);
    expect(new Set(results.map((r) => r.user.id)).size).toBe(1);
    expect(bindPendingMemberships).toHaveBeenCalled();
    for (const [user] of bindPendingMemberships.mock.calls as unknown as [{ email: string }][]) {
      expect(user.email).toBe(`${PREFIX}grace@example.com`);
    }
  });

  it('resurrects a row marked deleted while the Clerk session is valid (AC-017, EC-013)', async () => {
    const seeded = makeUser({ id: undefined, clerkId: `${PREFIX}revived`, email: `${PREFIX}revived@example.com` });
    const { id: _id, ...data } = seeded;
    void _id;
    await db.user.create({ data: { ...data, name: 'Old Name', deletedAt: new Date() } });
    const { requireUser } = requireUserFor({
      id: seeded.clerkId,
      firstName: 'New',
      lastName: 'Name',
      username: null,
      imageUrl: 'https://img.clerk.com/new',
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: seeded.email }],
    });

    const { user } = await requireUser();

    const row = await db.user.findUniqueOrThrow({ where: { clerkId: seeded.clerkId } });
    expect(row.deletedAt).toBeNull();
    expect(row).toMatchObject({ name: 'New Name', avatarUrl: 'https://img.clerk.com/new' });
    expect(user.id).toBe(row.id);
  });

  // FR-018 / D-043: a deleted account's email is held for 15 days, then released to a new account.
  describe('email hold after account deletion (AC-035)', () => {
    const NOW = new Date('2026-10-24T12:00:00.000Z');
    const DAY = 24 * 60 * 60 * 1000;

    function newAccount(clerkId: string, email: string): BackendUserLike {
      return {
        id: clerkId,
        firstName: 'Re',
        lastName: 'Joined',
        username: null,
        imageUrl: 'https://img.clerk.com/rejoined',
        primaryEmailAddressId: 'e1',
        emailAddresses: [{ id: 'e1', emailAddress: email }],
      };
    }

    function createdEvent(clerkId: string, email: string): WebhookEvent {
      return {
        type: 'user.created',
        object: 'event',
        data: { id: clerkId, email_addresses: [{ id: 'e1', email_address: email }], primary_email_address_id: 'e1' },
      } as unknown as WebhookEvent;
    }

    it('refuses a new account for an email deleted 3 days ago and keeps the old row intact', async () => {
      const email = `${PREFIX}held@example.com`;
      const deletedAt = new Date(NOW.getTime() - 3 * DAY);
      const old = await db.user.create({ data: { clerkId: `${PREFIX}held_old`, email, deletedAt } });

      const { requireUser, bindPendingMemberships } = requireUserFor(newAccount(`${PREFIX}held_new`, email), NOW);
      const err = await requireUser().then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(EmailHeldError);
      expect(err).toMatchObject({ code: 'FORBIDDEN', reason: 'recently-deleted' });
      expect((err as EmailHeldError).availableAt).toEqual(new Date(deletedAt.getTime() + 15 * DAY));
      expect(bindPendingMemberships).not.toHaveBeenCalled();

      const webhook = await handleClerkEvent(createdEvent(`${PREFIX}held_new`, email), {
        db,
        logger: createFakeLogger(),
        bindPendingMemberships: async () => ({ bound: 0 }),
        now: () => NOW,
      });
      expect(webhook).toEqual({ handled: false, reason: 'email-held' });

      expect(await db.user.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ email, deletedAt });
      expect(await db.user.count({ where: { clerkId: `${PREFIX}held_new` } })).toBe(0);
    });

    it('releases the email of an account deleted 16 days ago and creates the new live row', async () => {
      const email = `${PREFIX}released@example.com`;
      const deletedAt = new Date(NOW.getTime() - 16 * DAY);
      const old = await db.user.create({ data: { clerkId: `${PREFIX}released_old`, email, deletedAt } });

      const { requireUser } = requireUserFor(newAccount(`${PREFIX}released_new`, email), NOW);
      const { user } = await requireUser();

      expect(user).toMatchObject({ clerkId: `${PREFIX}released_new`, email });
      expect(await db.user.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
        email: `deleted+${old.id}@invalid`,
        deletedAt,
      });
      expect((await db.user.findUniqueOrThrow({ where: { email } })).deletedAt).toBeNull();
    });
  });

  it('user.deleted before user.created leaves only a tombstone (AC-036)', async () => {
    const clerkId = `${PREFIX}out_of_order`;
    const deps = { db, logger: createFakeLogger(), bindPendingMemberships: async () => ({ bound: 0 }) };
    const deleted = { type: 'user.deleted', object: 'event', data: { id: clerkId, deleted: true } };
    const created = {
      type: 'user.created',
      object: 'event',
      data: { id: clerkId, email_addresses: [{ id: 'e1', email_address: `${PREFIX}late@example.com` }], primary_email_address_id: 'e1' },
    };

    expect(await handleClerkEvent(deleted as unknown as WebhookEvent, deps)).toEqual({ handled: true });
    expect(await handleClerkEvent(created as unknown as WebhookEvent, deps)).toEqual({ handled: false, reason: 'user-deleted' });

    const rows = await db.user.findMany({ where: { clerkId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: `deleted+${clerkId}@invalid`, name: null, avatarUrl: null });
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
    expect(await db.user.count({ where: { email: `${PREFIX}late@example.com` } })).toBe(0);
  });
});
