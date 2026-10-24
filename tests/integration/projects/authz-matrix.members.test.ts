// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient, Project, ProjectMember } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed, missingProjectId } from '@/tests/integration/projects/seed';

const h = vi.hoisted(() => ({
  auth: { requireUser: vi.fn() },
  cache: { updateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() },
  liveblocks: { kickUser: vi.fn(async () => true), notifyRoleChanged: vi.fn(async () => true) },
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

const actions = await import('@/app/editor/[projectId]/actions');

const PREFIX = 'l2_mauthz_';
// Every failure carries its own requestId (F15 FR-007); the rest of the body is identical across callers.
const FORBIDDEN = { ok: false, error: { code: 'FORBIDDEN', message: "You don't have permission to do that.", requestId: expect.any(String) } };
const UNAUTHENTICATED = { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.', requestId: expect.any(String) } };

// AUTHZ-MATRIX (05-test-plan.md): every sharing action × unauthenticated / non-member (foreign and missing id)
// / viewer / editor / owner. Failures must be byte-identical and leave the member rows untouched.
describe.skipIf(!hasTestDatabase)('AUTHZ-MATRIX — sharing actions (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, editor: AuthUser, viewer: AuthUser, stranger: AuthUser;
  let project: Project;
  let editorRow: ProjectMember;

  const as = (user: AuthUser | null) =>
    user ? h.auth.requireUser.mockResolvedValue({ user }) : h.auth.requireUser.mockRejectedValue(new AccessError('UNAUTHENTICATED'));
  const snapshot = () => db.projectMember.findMany({ where: { project: { ownerId: owner.id } }, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
  }, 120_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    await seed.cleanup();
    owner = await seed.makeUser('owner');
    editor = await seed.makeUser('editor');
    viewer = await seed.makeUser('viewer');
    stranger = await seed.makeUser('stranger');
    project = await seed.makeProject(owner);
    editorRow = await seed.makeMember(project, 'EDITOR', { user: editor });
    await seed.makeMember(project, 'VIEWER', { user: viewer });
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  const mutations = {
    inviteMember: (projectId: string) => actions.inviteMember({ projectId, email: `${PREFIX}new@example.com`, role: 'editor' }),
    changeMemberRole: (projectId: string) => actions.changeMemberRole({ projectId, memberId: editorRow.id, role: 'viewer' }),
    removeMember: (projectId: string) => actions.removeMember({ projectId, memberId: editorRow.id }),
  };

  it.each(Object.keys(mutations) as (keyof typeof mutations)[])(
    '%s: UNAUTHENTICATED / identical FORBIDDEN for strangers, viewers and editors / ok for the owner (AC-028)',
    async (name) => {
      const run = mutations[name];
      const before = await snapshot();
      const cases: [AuthUser | null, string, unknown][] = [
        [null, project.id, UNAUTHENTICATED],
        [stranger, project.id, FORBIDDEN],
        [stranger, missingProjectId(), FORBIDDEN],
        [viewer, project.id, FORBIDDEN],
        [editor, project.id, FORBIDDEN],
      ];
      for (const [user, projectId, expected] of cases) {
        as(user);
        expect(await run(projectId)).toStrictEqual(expected);
      }
      expect(await snapshot()).toEqual(before);
      expect(h.cache.updateTag).not.toHaveBeenCalled();
      expect(h.liveblocks.kickUser).not.toHaveBeenCalled();
      expect(h.liveblocks.notifyRoleChanged).not.toHaveBeenCalled();

      as(owner);
      expect((await run(project.id)).ok).toBe(true);
    },
  );

  it('checkMyAccess returns each caller their role and the same FORBIDDEN for foreign and missing ids (AC-021)', async () => {
    const results = [];
    for (const user of [owner, editor, viewer]) {
      as(user);
      results.push(await actions.checkMyAccess({ projectId: project.id }));
    }
    expect(results).toEqual([
      { ok: true, data: { role: 'owner' } },
      { ok: true, data: { role: 'editor' } },
      { ok: true, data: { role: 'viewer' } },
    ]);
    as(stranger);
    expect(await actions.checkMyAccess({ projectId: project.id })).toStrictEqual(FORBIDDEN);
    expect(await actions.checkMyAccess({ projectId: missingProjectId() })).toStrictEqual(FORBIDDEN);
    as(null);
    expect(await actions.checkMyAccess({ projectId: project.id })).toStrictEqual(UNAUTHENTICATED);
  });
});
