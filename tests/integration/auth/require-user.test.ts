// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRequireUser } from '@/lib/auth';
import type { PrismaClient } from '@/lib/generated/prisma/client';
import { type BackendUserLike, markUserDeleted, upsertUserFromClerk } from '@/lib/users';
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
    expect(await markUserDeleted(db, `${PREFIX}missing`)).toBe('missing');
    expect(await db.user.count({ where: { clerkId: `${PREFIX}missing` } })).toBe(0);
  });

  function requireUserFor(backendUser: BackendUserLike) {
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
});
