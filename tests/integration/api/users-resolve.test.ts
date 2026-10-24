// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed } from '@/tests/integration/projects/seed';

const h = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});

const { GET } = await import('@/app/api/users/resolve/route');

const PREFIX = 'l2_resolve_';

function get(ids: string[]): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/users/resolve?ids=${ids.join(',')}`));
}

describe.skipIf(!hasTestDatabase)('GET /api/users/resolve (L2, AUTHZ-MATRIX)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let caller: AuthUser, u1: AuthUser, u2: AuthUser, u3: AuthUser;

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
    [caller, u1, u2, u3] = await Promise.all(['caller', 'u1', 'u2', 'u3'].map((label) => seed.makeUser(label)));
    // caller owns P1 (member u1) and is a member of P2 (owner u2); u3 shares nothing with the caller.
    const p1 = await seed.makeProject(caller);
    await seed.makeMember(p1, 'VIEWER', { user: u1 });
    const p2 = await seed.makeProject(u2);
    await seed.makeMember(p2, 'EDITOR', { user: caller });
    const p3 = await seed.makeProject(u3);
    await seed.makeMember(p3, 'EDITOR', { user: u1 });
  }, 120_000);

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  it('returns only users who share a project with the caller (AC-009, EC-012)', async () => {
    h.requireUser.mockResolvedValue({ user: caller });
    const res = await get([u1.id, u2.id, u3.id]);
    expect(res.status).toBe(200);
    const { users } = (await res.json()) as { users: { id: string; name: string; avatar: string | null }[] };
    expect(users.map((u) => u.id).sort()).toEqual([u1.id, u2.id].sort());
    expect(users.find((u) => u.id === u1.id)).toEqual({ id: u1.id, name: u1.name, avatar: null });
  });

  it('rejects more than 50 ids or non-cuids with 400, and signed-out callers with 401 (EC-011)', async () => {
    h.requireUser.mockResolvedValue({ user: caller });
    const many = Array.from({ length: 51 }, (_, i) => `c${String(i).padStart(24, '0')}`);
    expect((await get(many)).status).toBe(400);
    expect((await get(['nope'])).status).toBe(400);
    h.requireUser.mockRejectedValueOnce(new AccessError('UNAUTHENTICATED'));
    expect((await get([u1.id])).status).toBe(401);
  });
});
