// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient, Project } from '@/lib/generated/prisma/client';
import { userColor } from '@/lib/user-color';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed, missingProjectId } from '@/tests/integration/projects/seed';

// Real role resolution against the L2 database. Seams: `requireUser` (F02) and the Liveblocks session, which
// records what the route asks for instead of calling Liveblocks.
const h = vi.hoisted(() => {
  const session = { allow: vi.fn(), authorize: vi.fn() };
  return { requireUser: vi.fn(), session, prepareSession: vi.fn(() => session) };
});
vi.mock('@/lib/auth', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});
vi.mock('@/lib/liveblocks', async () => ({
  getLiveblocks: () => ({ prepareSession: h.prepareSession }),
  userColor: (await import('@/lib/user-color')).userColor,
}));

const { POST } = await import('@/app/api/liveblocks-auth/route');
const { prisma } = await import('@/lib/prisma');

const PREFIX = 'l2_lbauth_';

function post(body: unknown): Promise<Response> {
  return POST(new Request('http://localhost/api/liveblocks-auth', { method: 'POST', body: JSON.stringify(body) }));
}

describe.skipIf(!hasTestDatabase)('POST /api/liveblocks-auth (L2, AUTHZ-MATRIX)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, editor: AuthUser, viewer: AuthUser, stranger: AuthUser;
  let project: Project;

  const asUser = (user: AuthUser) => h.requireUser.mockResolvedValue({ user });

  beforeAll(async () => {
    migrateTestDatabase();
    db = createTestPrisma();
    seed = createSeed(db, PREFIX);
    await seed.cleanup();
    owner = await seed.makeUser('owner');
    editor = await seed.makeUser('editor');
    viewer = await seed.makeUser('viewer');
    stranger = await seed.makeUser('stranger');
    project = await seed.makeProject(owner);
    await seed.makeMember(project, 'EDITOR', { user: editor });
    await seed.makeMember(project, 'VIEWER', { user: viewer });
  }, 120_000);

  beforeEach(() => {
    vi.clearAllMocks();
    h.session.authorize.mockResolvedValue({ status: 200, body: '{"token":"t"}' });
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  it.each([
    ['owner', () => owner, '*:write'],
    ['editor', () => editor, '*:write'],
    ['viewer', () => viewer, '*:read'],
  ] as const)('%s gets a %s token carrying their identity and colour (AC-005, AC-008)', async (_, who, permission) => {
    const user = who();
    asUser(user);
    const res = await post({ room: project.id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: 't' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(h.prepareSession).toHaveBeenCalledWith(user.id, {
      userInfo: { name: user.name, color: userColor(user.id) },
    });
    expect(h.session.allow).toHaveBeenCalledExactlyOnceWith(project.id, [permission]);
  });

  it('binds an email-only membership and issues its role (AC-006)', async () => {
    const invitee = await seed.makeUser('invitee');
    await seed.makeMember(project, 'VIEWER', { email: invitee.email });
    asUser(invitee);
    expect((await post({ room: project.id })).status).toBe(200);
    expect(h.session.allow).toHaveBeenCalledWith(project.id, ['*:read']);
    const row = await db.projectMember.findFirstOrThrow({ where: { projectId: project.id, email: invitee.email } });
    expect(row.userId).toBe(invitee.id);
    expect(row.acceptedAt).not.toBeNull();
  });

  it('issues only read tokens on an archived project, even to its editor', async () => {
    const archived = await seed.makeProject(owner, { status: 'ARCHIVED' });
    await seed.makeMember(archived, 'EDITOR', { user: editor });
    asUser(editor);
    expect((await post({ room: archived.id })).status).toBe(200);
    expect(h.session.allow).toHaveBeenCalledWith(archived.id, ['*:read']);
  });

  it('answers the Liveblocks forbidden body to signed-out, non-member, missing project, and bad ids (AC-007)', async () => {
    h.requireUser.mockRejectedValueOnce(new AccessError('UNAUTHENTICATED'));
    const signedOut = await post({ room: project.id });
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toEqual({ error: 'forbidden', reason: 'unauthenticated' });

    asUser(stranger);
    const nonMember = await post({ room: project.id });
    const missing = await post({ room: missingProjectId() });
    expect([nonMember.status, missing.status]).toEqual([403, 403]);
    expect(await nonMember.text()).toBe(await missing.text());

    const findUnique = vi.spyOn(prisma.project, 'findUnique');
    for (const body of [{ room: 'not-a-cuid' }, {}, 'garbage']) {
      const res = await post(body);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden', reason: 'invalid_room' });
    }
    expect(findUnique).not.toHaveBeenCalled();
    expect(h.prepareSession).not.toHaveBeenCalled();
  });

  it('maps a Liveblocks failure to 502 UPSTREAM so the client retries (EC-016)', async () => {
    asUser(owner);
    h.session.authorize.mockRejectedValueOnce(new Error('liveblocks down'));
    const res = await post({ room: project.id });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'UPSTREAM' } });
  });
});
