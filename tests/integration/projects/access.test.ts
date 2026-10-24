// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient, Project } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase, testSchema } from '@/tests/integration/db';
import { createSeed, missingProjectId } from '@/tests/integration/projects/seed';

// lib/access.ts runs against the L2 database; `requireUser` is the auth seam (F02 owns its real behaviour).
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock('@/lib/auth', () => auth);
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});

const { getProjectRole, requireProjectRole, ROLE_RANK } = await import('@/lib/access');
const { bindPendingMemberships, removeMembershipsOfDeletedUser } = await import('@/lib/memberships');
const { prisma } = await import('@/lib/prisma');

const PREFIX = 'l2_access_';

describe.skipIf(!hasTestDatabase)('getProjectRole / requireProjectRole against Postgres (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, editor: AuthUser, viewer: AuthUser, pending: AuthUser, stranger: AuthUser, emailTwin: AuthUser;
  let project: Project;

  const asUser = (user: AuthUser) => auth.requireUser.mockResolvedValue({ user });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
  }, 120_000);

  beforeEach(async () => {
    await seed.cleanup();
    owner = await seed.makeUser('owner');
    editor = await seed.makeUser('editor');
    viewer = await seed.makeUser('viewer');
    pending = await seed.makeUser('pending');
    stranger = await seed.makeUser('stranger');
    emailTwin = await seed.makeUser('twin');
    project = await seed.makeProject(owner);
    await seed.makeMember(project, 'EDITOR', { user: editor });
    await seed.makeMember(project, 'VIEWER', { user: viewer });
    // Pending invite stored lowercase; the caller's email arrives in a different case (EC-007).
    await seed.makeMember(project, 'EDITOR', { email: pending.email });
    pending = { ...pending, email: pending.email.toUpperCase() };
    // A row whose email matches the twin but is already bound to someone else grants the twin nothing (EC-006).
    await db.projectMember.create({
      data: { projectId: project.id, email: emailTwin.email, role: 'VIEWER', userId: stranger.id, invitedById: owner.id },
    });
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  it('migration 2 created Project and ProjectMember with the spec indexes and cascade (AC-003)', async () => {
    const indexes = await db.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text AS indexname FROM pg_indexes WHERE schemaname = ${testSchema} AND tablename IN ('Project', 'ProjectMember')`;
    expect(indexes.map((i) => i.indexname)).toEqual(
      expect.arrayContaining([
        'Project_ownerId_createdAt_idx',
        'Project_status_idx',
        'ProjectMember_email_idx',
        'ProjectMember_userId_idx',
        'ProjectMember_projectId_role_idx',
        'ProjectMember_projectId_email_key',
      ]),
    );
    const [fk] = await db.$queryRaw<{ delete_rule: string }[]>`
      SELECT delete_rule::text AS delete_rule FROM information_schema.referential_constraints
      WHERE constraint_schema = ${testSchema} AND constraint_name = 'ProjectMember_projectId_fkey'`;
    expect(fk?.delete_rule).toBe('CASCADE');
  });

  it('resolves the role matrix, binding an email-only invite on first call (AC-005, AC-008)', async () => {
    const roles = await Promise.all(
      [owner, editor, viewer, stranger, emailTwin].map((user) => getProjectRole(user, project.id)),
    );
    // stranger is bound to the twin's row, so it resolves to that row's role; the twin itself gets nothing.
    expect(roles).toEqual(['owner', 'editor', 'viewer', 'viewer', null]);

    const concurrent = await Promise.all([getProjectRole(pending, project.id), getProjectRole(pending, project.id)]);
    expect(concurrent).toEqual(['editor', 'editor']);
    const row = await db.projectMember.findFirstOrThrow({ where: { projectId: project.id, email: pending.email.toLowerCase() } });
    expect(row.userId).toBe(pending.id);
    expect(row.acceptedAt).toBeInstanceOf(Date);
    expect(await getProjectRole(pending, project.id)).toBe('editor');
  });

  it('returns null without querying for malformed ids, and null for missing or deleted-owner projects (AC-006, AC-007)', async () => {
    const findUnique = vi.spyOn(prisma.project, 'findUnique');
    for (const id of ['', 'not-a-cuid', '../etc', 'c'.padEnd(1000, 'x-')]) {
      expect(await getProjectRole(owner, id)).toBeNull();
    }
    expect(findUnique).not.toHaveBeenCalled();
    findUnique.mockRestore();

    expect(await getProjectRole(editor, missingProjectId())).toBeNull();
    await db.user.update({ where: { id: owner.id }, data: { deletedAt: new Date() } });
    expect(await getProjectRole(editor, project.id)).toBeNull();
  });

  it('requireProjectRole resolves iff the role ranks high enough, else FORBIDDEN (AC-009)', async () => {
    const levels = ['viewer', 'editor', 'owner'] as const;
    const users = { owner, editor, viewer };
    for (const role of levels) {
      for (const atLeast of levels) {
        asUser(users[role]);
        const result = requireProjectRole(project.id, atLeast);
        if (ROLE_RANK[role] >= ROLE_RANK[atLeast]) await expect(result).resolves.toMatchObject({ role });
        else await expect(result).rejects.toMatchObject({ code: 'FORBIDDEN' });
      }
    }
  });

  it('gives a missing and a foreign project the byte-identical FORBIDDEN (AC-010)', async () => {
    asUser(stranger);
    const other = await seed.makeProject(owner, { name: 'Foreign' });
    const errors = await Promise.all(
      [other.id, missingProjectId()].map((id) => requireProjectRole(id, 'viewer').catch((e: unknown) => e)),
    );
    for (const err of errors) {
      expect(err).toBeInstanceOf(AccessError);
      expect(err).toMatchObject({ code: 'FORBIDDEN', reason: undefined });
    }
    expect(JSON.stringify(errors[0])).toBe(JSON.stringify(errors[1]));
  });

  it('lets archived projects be read and owner-managed but refuses editor work (AC-011)', async () => {
    await db.project.update({ where: { id: project.id }, data: { status: 'ARCHIVED' } });
    const cases = [
      [editor, 'viewer', null],
      [owner, 'editor', 'PROJECT_ARCHIVED'],
      [editor, 'editor', 'PROJECT_ARCHIVED'],
      [owner, 'owner', null],
    ] as const;
    for (const [user, atLeast, reason] of cases) {
      asUser(user);
      const result = requireProjectRole(project.id, atLeast);
      if (reason) await expect(result).rejects.toMatchObject({ code: 'FORBIDDEN', reason });
      else await expect(result).resolves.toMatchObject({ project: { status: 'ARCHIVED' } });
    }
  });

  it('cascades member rows on project delete and keeps the owner (AC-004)', async () => {
    await db.project.delete({ where: { id: project.id } });
    expect(await db.projectMember.count({ where: { projectId: project.id } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
  });

  it('binds all pending invites on sign-in and removes a deleted user’s memberships (PRD-011, deletion lifecycle)', async () => {
    const second = await seed.makeProject(stranger, { name: 'Second' });
    await seed.makeMember(second, 'VIEWER', { email: pending.email });
    await expect(bindPendingMemberships(pending, db)).resolves.toEqual({ bound: 2 });
    await expect(bindPendingMemberships(pending, db)).resolves.toEqual({ bound: 0 });
    // The twin's email row is bound to stranger and must stay so.
    await expect(bindPendingMemberships(emailTwin, db)).resolves.toEqual({ bound: 0 });

    await expect(removeMembershipsOfDeletedUser(editor.clerkId, db)).resolves.toEqual({ removed: 1 });
    expect(await getProjectRole(editor, project.id)).toBeNull();
    expect(await getProjectRole(viewer, project.id)).toBe('viewer');
  });
});
