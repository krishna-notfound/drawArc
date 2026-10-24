// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import type { PrismaClient, Project } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed } from '@/tests/integration/projects/seed';

// Seams: `requireUser`, `next/cache` (records tags), `lib/liveblocks` (broadcast spies), and the logger.
const h = vi.hoisted(() => ({
  auth: { requireUser: vi.fn() },
  cache: { updateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() },
  liveblocks: { kickUser: vi.fn(), notifyRoleChanged: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/auth', () => h.auth);
vi.mock('next/cache', () => h.cache);
vi.mock('@/lib/liveblocks', () => h.liveblocks);
vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});

const { inviteMember, changeMemberRole, removeMember } = await import('@/app/editor/[projectId]/actions');
const { listProjectMembers } = await import('@/lib/projects/members');

const PREFIX = 'l2_members_';

describe.skipIf(!hasTestDatabase)('sharing Server Actions against Postgres (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, bob: AuthUser;
  let project: Project;

  const asUser = (user: AuthUser) => h.auth.requireUser.mockResolvedValue({ user });
  const tags = () => h.cache.updateTag.mock.calls.map(([tag]) => tag as string);
  const membersTag = () => `project:${project.id}:members`;
  const rowCount = () => db.projectMember.count({ where: { projectId: project.id } });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
  }, 120_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    h.liveblocks.kickUser.mockResolvedValue(true);
    h.liveblocks.notifyRoleChanged.mockResolvedValue(true);
    await seed.cleanup();
    owner = await seed.makeUser('owner');
    bob = await seed.makeUser('bob');
    project = await seed.makeProject(owner);
    asUser(owner);
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  describe('inviteMember rules', () => {
    it('normalises the email, stores a pending row, and refuses archived projects (AC-012, EC-020)', async () => {
      const result = await inviteMember({ projectId: project.id, email: `  ${PREFIX}New.User@Example.com `, role: 'viewer' });
      expect(result).toMatchObject({ ok: true, data: { email: `${PREFIX}new.user@example.com`, status: 'pending', role: 'viewer' } });
      const row = await db.projectMember.findFirstOrThrow({ where: { projectId: project.id } });
      expect(row).toMatchObject({ email: `${PREFIX}new.user@example.com`, role: 'VIEWER', userId: null, acceptedAt: null });
      expect(tags()).toEqual([membersTag()]);

      const archived = await seed.makeProject(owner, { status: 'ARCHIVED' });
      const refused = await inviteMember({ projectId: archived.id, email: bob.email, role: 'editor' });
      expect(refused).toMatchObject({ ok: false, error: { code: 'CONFLICT', reason: 'PROJECT_ARCHIVED' } });
      expect(await db.projectMember.count({ where: { projectId: archived.id } })).toBe(0);
    });

    it('rejects self and duplicate invitations, including a concurrent duplicate (AC-013, AC-014)', async () => {
      const self = await inviteMember({ projectId: project.id, email: owner.email.toUpperCase(), role: 'editor' });
      expect(self).toMatchObject({ ok: false, error: { code: 'CONFLICT', reason: 'SELF_INVITE', message: 'You already own this project.' } });

      const email = `${PREFIX}twin@example.com`;
      const both = await Promise.all([
        inviteMember({ projectId: project.id, email, role: 'editor' }),
        inviteMember({ projectId: project.id, email, role: 'viewer' }),
      ]);
      expect(both.filter((r) => r.ok)).toHaveLength(1);
      expect(both.find((r) => !r.ok)).toMatchObject({ error: { code: 'CONFLICT', reason: 'DUPLICATE_MEMBER' } });

      const again = await inviteMember({ projectId: project.id, email: email.toUpperCase(), role: 'viewer' });
      expect(again).toMatchObject({ ok: false, error: { code: 'CONFLICT', reason: 'DUPLICATE_MEMBER', message: `${email} already has access.` } });
      expect(await rowCount()).toBe(1);
    });

    it('allows 20 invitations per rolling hour across projects, then RATE_LIMITED (AC-015, EC-004)', async () => {
      const other = await seed.makeProject(owner);
      for (let i = 0; i < 20; i++) await seed.makeMember(i < 10 ? project : other, 'VIEWER', { email: `${PREFIX}r${i}@example.com` });

      const limited = await inviteMember({ projectId: project.id, email: `${PREFIX}r20@example.com`, role: 'viewer' });
      expect(limited).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
      expect(await db.projectMember.count({ where: { email: `${PREFIX}r20@example.com` } })).toBe(0);
      expect(h.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: owner.id, op: 'inviteMember' }), expect.any(String));

      await db.projectMember.updateMany({ where: { email: `${PREFIX}r0@example.com` }, data: { invitedAt: new Date(Date.now() - 61 * 60_000) } });
      const allowed = await inviteMember({ projectId: project.id, email: `${PREFIX}r20@example.com`, role: 'viewer' });
      expect(allowed.ok).toBe(true);
    });

    it('binds the row to an existing account and invalidates their shared list (AC-015)', async () => {
      const result = await inviteMember({ projectId: project.id, email: bob.email, role: 'editor' });
      expect(result).toMatchObject({ ok: true, data: { status: 'active', name: bob.name, role: 'editor' } });
      const row = await db.projectMember.findFirstOrThrow({ where: { projectId: project.id } });
      expect(row.userId).toBe(bob.id);
      expect(row.acceptedAt).toBeInstanceOf(Date);
      expect(tags()).toEqual([membersTag(), `projects:shared:${bob.id}`]);
    });
  });

  describe('changeMemberRole / removeMember', () => {
    it('no-ops on the same role; otherwise writes, invalidates, then broadcasts ROLE_CHANGED (AC-016, EC-013)', async () => {
      const member = await seed.makeMember(project, 'EDITOR', { user: bob });
      const same = await changeMemberRole({ projectId: project.id, memberId: member.id, role: 'editor' });
      expect(same).toMatchObject({ ok: true, data: { kickDelivered: true } });
      expect(h.cache.updateTag).not.toHaveBeenCalled();
      expect(h.liveblocks.notifyRoleChanged).not.toHaveBeenCalled();

      let roleAtBroadcast: string | undefined;
      h.liveblocks.notifyRoleChanged.mockImplementation(async () => {
        roleAtBroadcast = (await db.projectMember.findUniqueOrThrow({ where: { id: member.id } })).role;
        return true;
      });
      const changed = await changeMemberRole({ projectId: project.id, memberId: member.id, role: 'viewer' });
      expect(changed).toMatchObject({ ok: true, data: { member: { role: 'viewer' }, kickDelivered: true } });
      expect(h.liveblocks.notifyRoleChanged).toHaveBeenCalledExactlyOnceWith(project.id, bob.id, 'viewer');
      expect(roleAtBroadcast).toBe('VIEWER'); // broadcast ran after the write
      expect(h.liveblocks.kickUser).not.toHaveBeenCalled();
      expect(tags()).toEqual([membersTag(), `projects:shared:${bob.id}`]);
    });

    it('pending rows change silently; archived refuses; a foreign member id is NOT_FOUND (AC-017)', async () => {
      const pending = await seed.makeMember(project, 'EDITOR', { email: `${PREFIX}p@example.com` });
      expect(await changeMemberRole({ projectId: project.id, memberId: pending.id, role: 'viewer' })).toMatchObject({ ok: true });
      expect(h.liveblocks.notifyRoleChanged).not.toHaveBeenCalled();

      const other = await seed.makeProject(owner);
      const foreign = await seed.makeMember(other, 'EDITOR', { user: bob });
      expect(await changeMemberRole({ projectId: project.id, memberId: foreign.id, role: 'viewer' })).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'This member was already removed.' },
      });

      const archived = await seed.makeProject(owner, { status: 'ARCHIVED' });
      const archivedMember = await seed.makeMember(archived, 'EDITOR', { user: bob });
      expect(await changeMemberRole({ projectId: archived.id, memberId: archivedMember.id, role: 'viewer' })).toMatchObject({
        ok: false,
        error: { code: 'CONFLICT', reason: 'PROJECT_ARCHIVED' },
      });
    });

    it('removes, invalidates and KICKs a bound member — also on archived projects — and NOT_FOUND twice (AC-018, AC-019)', async () => {
      const member = await seed.makeMember(project, 'EDITOR', { user: bob });
      const removed = await removeMember({ projectId: project.id, memberId: member.id });
      expect(removed).toEqual({ ok: true, data: { memberId: member.id, kickDelivered: true } });
      expect(await rowCount()).toBe(0);
      expect(h.liveblocks.kickUser).toHaveBeenCalledExactlyOnceWith(project.id, bob.id);
      expect(h.liveblocks.notifyRoleChanged).not.toHaveBeenCalled();
      expect(tags()).toEqual([membersTag(), `projects:shared:${bob.id}`]);

      h.liveblocks.kickUser.mockClear();
      expect(await removeMember({ projectId: project.id, memberId: member.id })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
      expect(h.liveblocks.kickUser).not.toHaveBeenCalled();

      const archived = await seed.makeProject(owner, { status: 'ARCHIVED' });
      const archivedMember = await seed.makeMember(archived, 'VIEWER', { user: bob });
      expect(await removeMember({ projectId: archived.id, memberId: archivedMember.id })).toMatchObject({ ok: true });
    });

    it('keeps the database change when the room event is not delivered (AC-020, EC-009)', async () => {
      h.liveblocks.kickUser.mockResolvedValue(false);
      h.liveblocks.notifyRoleChanged.mockResolvedValue(false);
      const a = await seed.makeMember(project, 'EDITOR', { user: bob });
      expect(await changeMemberRole({ projectId: project.id, memberId: a.id, role: 'viewer' })).toMatchObject({ ok: true, data: { kickDelivered: false } });
      expect((await db.projectMember.findUniqueOrThrow({ where: { id: a.id } })).role).toBe('VIEWER');
      expect(await removeMember({ projectId: project.id, memberId: a.id })).toMatchObject({ ok: true, data: { kickDelivered: false } });
      expect(await rowCount()).toBe(0);
    });
  });

  it('lists the owner and members by invitedAt; a deleted account renders as pending (AC-010, EC-017)', async () => {
    const gone = await seed.makeUser('gone', { deletedAt: new Date() });
    await seed.makeMember(project, 'EDITOR', { user: bob });
    await seed.makeMember(project, 'VIEWER', { email: `${PREFIX}c@x.io` });
    await seed.makeMember(project, 'VIEWER', { user: gone });

    const list = await listProjectMembers(project.id);
    expect(list.owner).toMatchObject({ id: owner.id, email: owner.email });
    expect(list.members.map((m) => [m.email, m.status, m.name])).toEqual([
      [bob.email, 'active', bob.name],
      [`${PREFIX}c@x.io`, 'pending', null],
      [gone.email, 'pending', null],
    ]);
    expect(h.cache.cacheTag).toHaveBeenCalledWith(membersTag());
  });
});
