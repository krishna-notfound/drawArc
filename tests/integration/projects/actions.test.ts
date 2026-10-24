// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient, Project } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed, missingProjectId } from '@/tests/integration/projects/seed';

// Seams: `requireUser` (auth), `next/cache` (records tags), the externals no-op (spies), and the logger.
const h = vi.hoisted(() => {
  const calls: string[] = [];
  const spy = (op: string) => vi.fn<(...args: unknown[]) => Promise<void>>(async () => void calls.push(op));
  return {
    calls,
    auth: { requireUser: vi.fn() },
    cache: { updateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() },
    externals: { ensureRoom: spy('ensureRoom'), kickUsers: spy('kickUsers'), deleteSnapshot: spy('deleteSnapshot'), deleteRoom: spy('deleteRoom') },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
  };
});
vi.mock('@/lib/auth', () => h.auth);
vi.mock('next/cache', () => h.cache);
vi.mock('@/lib/projects/externals', () => ({ defaultExternals: h.externals }));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});

const actions = await import('@/app/editor/actions');
const { listMyProjects, listSharedProjects } = await import('@/lib/projects/queries');
const { prisma } = await import('@/lib/prisma');

const PREFIX = 'l2_actions_';
// Every failure carries its own requestId (F15 FR-007); the rest of the body is identical across callers.
const FORBIDDEN = { ok: false, error: { code: 'FORBIDDEN', message: "You don't have permission to do that.", requestId: expect.any(String) } };
const UNAUTHENTICATED = { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.', requestId: expect.any(String) } };

describe.skipIf(!hasTestDatabase)('project Server Actions and lists against Postgres (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, editor: AuthUser, viewer: AuthUser, stranger: AuthUser;
  let project: Project;

  const asUser = (user: AuthUser) => h.auth.requireUser.mockResolvedValue({ user });
  const asAnonymous = () => h.auth.requireUser.mockRejectedValue(new AccessError('UNAUTHENTICATED'));
  const tags = () => h.cache.updateTag.mock.calls.map(([tag]) => tag as string);

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
  }, 120_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    h.calls.length = 0;
    await seed.cleanup();
    owner = await seed.makeUser('owner');
    editor = await seed.makeUser('editor');
    viewer = await seed.makeUser('viewer');
    stranger = await seed.makeUser('stranger');
    project = await seed.makeProject(owner, { name: 'Original' });
    await seed.makeMember(project, 'EDITOR', { user: editor });
    await seed.makeMember(project, 'VIEWER', { user: viewer });
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  describe('AUTHZ-MATRIX', () => {
    const ownerOnly = ['renameProject', 'archiveProject', 'unarchiveProject', 'deleteProject'] as const;
    const input = (projectId: string) => ({ projectId, name: 'Hijacked' });

    it('denies every owner-only action to anonymous, strangers, viewers and editors without changing the row (AC-026, AC-029, AC-030)', async () => {
      const foreign = await seed.makeProject(owner, { name: 'Foreign' });
      const cases: [string, () => void, string, unknown][] = [
        ['anonymous', asAnonymous, project.id, UNAUTHENTICATED],
        ['stranger (foreign id)', () => asUser(stranger), foreign.id, FORBIDDEN],
        ['stranger (missing id)', () => asUser(stranger), missingProjectId(), FORBIDDEN],
        ['viewer', () => asUser(viewer), project.id, FORBIDDEN],
        ['editor', () => asUser(editor), project.id, FORBIDDEN],
      ];
      for (const [who, signIn, projectId, expected] of cases) {
        for (const action of ownerOnly) {
          signIn();
          expect(await actions[action](input(projectId)), `${action} as ${who}`).toStrictEqual(expected);
        }
      }
      asAnonymous();
      expect(await actions.createProject({ name: 'Nope' })).toStrictEqual(UNAUTHENTICATED);

      expect(await db.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ name: 'Original', status: 'ACTIVE' });
      expect(await db.project.count({ where: { owner: { clerkId: { startsWith: PREFIX } } } })).toBe(2);
      expect(h.cache.updateTag).not.toHaveBeenCalled();
      expect(h.calls).toEqual([]);
    });

    it('lets the owner perform each owner-only action, and any signed-in user create (AC-030)', async () => {
      asUser(owner);
      for (const action of ownerOnly) {
        expect(await actions[action](input(project.id)), action).toMatchObject({ ok: true });
      }
      for (const user of [editor, viewer]) {
        asUser(user);
        expect(await actions.createProject({})).toMatchObject({ ok: true });
      }
    });
  });

  it('createProject inserts an owned ACTIVE project, ensures its room and tags the owned list (AC-013)', async () => {
    asUser(owner);
    const result = await actions.createProject({ name: 'Billing' });
    if (!result.ok) throw new Error(result.error.code);
    expect(await db.project.findUniqueOrThrow({ where: { id: result.data.id } })).toMatchObject({
      ownerId: owner.id,
      status: 'ACTIVE',
      name: 'Billing',
    });
    expect(h.externals.ensureRoom).toHaveBeenCalledExactlyOnceWith(result.data.id);
    expect(tags()).toEqual([`projects:owned:${owner.id}`]);
  });

  it('createProject survives a failing ensureRoom with a warning, defaulting the name (AC-014)', async () => {
    asUser(owner);
    h.externals.ensureRoom.mockRejectedValueOnce(new Error('liveblocks down'));
    const result = await actions.createProject({ name: '   ' });
    if (!result.ok) throw new Error(result.error.code);
    expect(await db.project.findUniqueOrThrow({ where: { id: result.data.id } })).toMatchObject({ name: 'Untitled Project' });
    expect(h.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ op: 'ensureRoom', projectId: result.data.id }), expect.any(String));
  });

  it('renameProject updates and echoes the row, tags the project, and refuses archived projects (AC-015, AC-016)', async () => {
    asUser(owner);
    const result = await actions.renameProject({ projectId: project.id, name: 'New', description: 'd' });
    expect(result).toEqual({ ok: true, data: { id: project.id, name: 'New', description: 'd' } });
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.updatedAt.getTime()).toBeGreaterThan(project.updatedAt.getTime());
    expect(tags()).toEqual([`project:${project.id}`]);

    await db.project.update({ where: { id: project.id }, data: { status: 'ARCHIVED' } });
    expect(await actions.renameProject({ projectId: project.id, name: 'Blocked' })).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', reason: 'PROJECT_ARCHIVED', message: 'This project is archived. Unarchive it to make changes.' },
    });
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).name).toBe('New');
  });

  it('archive/unarchive are idempotent and update both tags on every call (AC-017)', async () => {
    asUser(owner);
    const both = [`project:${project.id}`, `projects:owned:${owner.id}`];
    for (const [action, status] of [
      ['archiveProject', 'ARCHIVED'],
      ['archiveProject', 'ARCHIVED'],
      ['unarchiveProject', 'ACTIVE'],
      ['unarchiveProject', 'ACTIVE'],
    ] as const) {
      h.cache.updateTag.mockClear();
      expect(await actions[action]({ projectId: project.id })).toEqual({ ok: true, data: { id: project.id, status } });
      expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status).toBe(status);
      expect(tags()).toEqual(both);
    }
  });

  it('deleteProject removes the row and members, then kicks bound users, deletes snapshot and room in order (AC-018)', async () => {
    await db.project.update({ where: { id: project.id }, data: { canvasBlobPath: `canvas/${project.id}.json` } });
    await seed.makeMember(project, 'VIEWER', { email: `${PREFIX}pending@example.com` });
    asUser(owner);
    expect(await actions.deleteProject({ projectId: project.id })).toEqual({ ok: true, data: { id: project.id } });
    expect(await db.project.count({ where: { id: project.id } })).toBe(0);
    expect(await db.projectMember.count({ where: { projectId: project.id } })).toBe(0);
    expect(h.calls).toEqual(['kickUsers', 'deleteSnapshot', 'deleteRoom']);
    const [, kicked] = h.externals.kickUsers.mock.calls[0] as [string, string[]];
    expect([...kicked].sort()).toEqual([owner.id, editor.id, viewer.id].sort());
    expect(kicked[0]).toBe(owner.id);
    expect(tags()).toEqual([`project:${project.id}`, `projects:owned:${owner.id}`]);
  });

  it('deleteProject succeeds when room and snapshot clean-up fail, logging both (AC-019)', async () => {
    h.externals.deleteRoom.mockRejectedValueOnce(new Error('room'));
    h.externals.deleteSnapshot.mockRejectedValueOnce(new Error('blob'));
    asUser(owner);
    expect(await actions.deleteProject({ projectId: project.id })).toMatchObject({ ok: true });
    expect(await db.project.count({ where: { id: project.id } })).toBe(0);
    expect(h.logger.error.mock.calls.map(([ctx]) => (ctx as { op: string; projectId: string }).op)).toEqual(['deleteSnapshot', 'deleteRoom']);
    for (const [ctx] of h.logger.error.mock.calls) expect(ctx).toMatchObject({ projectId: project.id });
  });

  it('maps bad input to VALIDATION, a database failure to UPSTREAM and a rename after delete to NOT_FOUND (AC-025)', async () => {
    asUser(owner);
    expect(await actions.renameProject({ projectId: 'nope', name: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', fieldErrors: { projectId: [expect.any(String)] } },
    });

    const update = vi.spyOn(prisma.project, 'update').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    expect(await actions.renameProject({ projectId: project.id, name: 'x' })).toStrictEqual({
      ok: false,
      error: { code: 'UPSTREAM', message: 'Something went wrong. Please try again.', requestId: expect.any(String) },
    });
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'renameProject', userId: owner.id, projectId: project.id }),
      expect.any(String),
    );
    update.mockRestore();

    // EC-012: authorized, then the row disappears before the update reaches Postgres.
    const find = vi.spyOn(prisma.project, 'findUnique');
    find.mockImplementationOnce((async (args: Parameters<typeof prisma.project.findUnique>[0]) => {
      const row = await db.project.findUnique({ ...args, select: { id: true, ownerId: true, name: true, status: true, owner: { select: { deletedAt: true } } } });
      await db.project.delete({ where: { id: project.id } });
      return row;
    }) as never);
    expect(await actions.renameProject({ projectId: project.id, name: 'Late' })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    find.mockRestore();
  });

  it('lists owned and shared projects with per-user and per-project tags, excluding pending, archived and orphaned rows (AC-021–AC-023)', async () => {
    const theirs = await seed.makeProject(stranger, { name: 'Theirs' });
    await seed.makeMember(theirs, 'EDITOR', { user: owner });
    const pendingOnly = await seed.makeProject(stranger, { name: 'Pending' });
    await seed.makeMember(pendingOnly, 'VIEWER', { email: owner.email });

    expect(await listMyProjects(owner.id)).toEqual([
      { id: project.id, name: 'Original', updatedAt: project.updatedAt.toISOString(), role: 'owner', ownerName: owner.name },
    ]);
    expect(h.cache.cacheTag).toHaveBeenLastCalledWith(`projects:owned:${owner.id}`, `project:${project.id}`);
    expect(await listSharedProjects(owner.id)).toEqual([
      { id: theirs.id, name: 'Theirs', updatedAt: theirs.updatedAt.toISOString(), role: 'editor', ownerName: stranger.name },
    ]);
    expect(h.cache.cacheTag).toHaveBeenLastCalledWith(`projects:shared:${owner.id}`, `project:${theirs.id}`);
    expect(h.cache.cacheLife).toHaveBeenCalledWith('minutes');

    await db.project.update({ where: { id: project.id }, data: { status: 'ARCHIVED' } });
    expect(await listMyProjects(owner.id)).toEqual([]);
    await db.user.update({ where: { id: stranger.id }, data: { deletedAt: new Date() } });
    expect(await listSharedProjects(owner.id)).toEqual([]);
  });
});
