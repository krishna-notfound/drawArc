// @vitest-environment node
import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth';
import { AccessError } from '@/lib/errors';
import type { PrismaClient, Project } from '@/lib/generated/prisma/client';
import { createTestPrisma, hasTestDatabase, migrateTestDatabase } from '@/tests/integration/db';
import { createSeed, missingProjectId } from '@/tests/integration/projects/seed';
import type { CanvasDocument } from '@/types/canvas';

// Real role resolution and pointer writes on the L2 database. Seams: `requireUser` (F02) and `lib/blob.ts`.
const h = vi.hoisted(() => ({
  requireUser: vi.fn(),
  putCanvas: vi.fn(),
  getCanvas: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/prisma', async () => {
  const db = await import('@/tests/integration/db');
  return { prisma: db.hasTestDatabase ? db.createTestPrisma() : {} };
});
vi.mock('@/lib/blob', () => ({
  putCanvas: h.putCanvas,
  getCanvas: h.getCanvas,
  BlobCorruptError: class BlobCorruptError extends Error {},
}));

const { PUT, GET } = await import('@/app/api/projects/[projectId]/canvas/route');

const PREFIX = 'l2_canvas_';
const small = JSON.parse(readFileSync('tests/fixtures/canvas/v1-small.json', 'utf8')) as CanvasDocument;
const EMPTY: CanvasDocument = { schemaVersion: 2, nodes: [], edges: [] };
const ULID_TAIL = (i: number) => String(i).padStart(26, '0').replace(/[ILOU]/g, '0');

type Ctx = Parameters<typeof PUT>[1];
const ctxFor = (projectId: string) => ({ params: Promise.resolve({ projectId }) }) as unknown as Ctx;
/** An error body without its per-request id, to compare two error bodies for equality. */
function withoutRequestId(body: { error: Record<string, unknown> }): unknown {
  return { ...body, error: { ...body.error, requestId: undefined } };
}

function put(projectId: string, body: unknown, raw = false): Promise<Response> {
  const init = { method: 'PUT', body: raw ? (body as string) : JSON.stringify(body) };
  return PUT(new Request(`http://localhost/api/projects/${projectId}/canvas`, init), ctxFor(projectId));
}
function get(projectId: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/projects/${projectId}/canvas`), ctxFor(projectId));
}

describe.skipIf(!hasTestDatabase)('/api/projects/[projectId]/canvas (L2)', { timeout: 60_000 }, () => {
  let db: PrismaClient;
  let seed: ReturnType<typeof createSeed>;
  let owner: AuthUser, editor: AuthUser, viewer: AuthUser, stranger: AuthUser;
  let project: Project;

  const asUser = (user: AuthUser) => h.requireUser.mockResolvedValue({ user });
  const resetPointer = (data: { canvasBlobPath?: string | null; canvasSavedAt?: Date | null } = {}) =>
    db.project.update({
      where: { id: project.id },
      data: { canvasBlobPath: null, canvasSavedAt: null, canvasSchemaVersion: null, ...data },
    });

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

  beforeEach(async () => {
    vi.clearAllMocks();
    h.putCanvas.mockImplementation(async (id: string) => ({ pathname: `canvas/${id}.json`, size: 123 }));
    h.getCanvas.mockResolvedValue({ json: small, size: 123 });
    await resetPointer();
  });

  afterAll(async () => {
    await seed.cleanup();
    await db.$disconnect();
  });

  describe('AUTHZ-MATRIX (AC-004, AC-010)', () => {
    it.each([
      ['owner', () => owner],
      ['editor', () => editor],
    ] as const)('%s saves and the pointer is recorded after the put', async (_, who) => {
      asUser(who());
      const res = await put(project.id, { document: small });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ savedAt: expect.any(String), schemaVersion: 2, size: 123, pointerUpdated: true });
      expect(h.putCanvas).toHaveBeenCalledWith(project.id, { ...small, schemaVersion: 2 });
      const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
      expect(row.canvasBlobPath).toBe(`canvas/${project.id}.json`);
      expect(row.canvasSchemaVersion).toBe(2);
      expect(Math.abs(row.canvasSavedAt!.getTime() - Date.now())).toBeLessThan(5_000);
    });

    it('viewer and non-member cannot save; a missing project answers the identical 403; signed-out is 401', async () => {
      asUser(viewer);
      const asViewer = await put(project.id, { document: small });
      asUser(stranger);
      const asStranger = await put(project.id, { document: small });
      const missing = await put(missingProjectId(), { document: small });
      h.requireUser.mockRejectedValueOnce(new AccessError('UNAUTHENTICATED'));
      const signedOut = await put(project.id, { document: small });

      expect([asViewer.status, asStranger.status, missing.status, signedOut.status]).toEqual([403, 403, 403, 401]);
      // Identical apart from each response's own requestId (F15 FR-007): no existence leak.
      expect(withoutRequestId(await missing.json())).toEqual(withoutRequestId(await asStranger.json()));
      expect(h.putCanvas).not.toHaveBeenCalled();
    });

    it('every member reads the snapshot (no-store); non-member and missing get the same 403; signed-out 401', async () => {
      for (const user of [owner, editor, viewer]) {
        asUser(user);
        const res = await get(project.id);
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(await res.json()).toEqual({ document: { ...small, schemaVersion: 2 }, savedAt: null, schemaVersion: 2 });
      }
      asUser(stranger);
      const asStranger = await get(project.id);
      const missing = await get(missingProjectId());
      h.requireUser.mockRejectedValueOnce(new AccessError('UNAUTHENTICATED'));
      const signedOut = await get(project.id);
      expect([asStranger.status, missing.status, signedOut.status]).toEqual([403, 403, 401]);
      // Identical apart from each response's own requestId (F15 FR-007): no existence leak.
      expect(withoutRequestId(await missing.json())).toEqual(withoutRequestId(await asStranger.json()));
    });
  });

  describe('validation and guards (AC-005, AC-006, AC-007)', () => {
    const node = (i: number) => ({ ...small.nodes[0]!, id: `rectangle_${ULID_TAIL(i)}` });

    it('rejects malformed envelopes with 400 and oversize, over-cap or invalid documents with 422, never storing', async () => {
      asUser(editor);
      const tooManyNodes = { ...EMPTY, nodes: Array.from({ length: 2001 }, (_, i) => node(i)) };
      const edge = { ...small.edges[0]!, source: small.nodes[0]!.id, target: small.nodes[1]!.id };
      const tooManyEdges = {
        ...small,
        edges: Array.from({ length: 4001 }, (_, i) => ({ ...edge, id: `e_${ULID_TAIL(i)}` })),
      };
      const narrow = { ...small, nodes: [{ ...small.nodes[0]!, width: 10 }, ...small.nodes.slice(1)] };

      const cases: [unknown, boolean, number][] = [
        ['x'.repeat(4 * 1024 * 1024 + 1), true, 422],
        [{ document: tooManyNodes }, false, 422],
        [{ document: tooManyEdges }, false, 422],
        [{ document: narrow }, false, 422],
        [{ document: 'nope' }, false, 422],
        ['{not json', true, 400],
        [{ document: small, extra: 1 }, false, 400],
      ];
      const statuses = [];
      for (const [body, raw] of cases) statuses.push((await put(project.id, body, raw)).status);
      expect(statuses).toEqual(cases.map(([, , status]) => status));

      const narrowRes = await (await put(project.id, { document: narrow })).json();
      expect(narrowRes.error.code).toBe('VALIDATION');
      expect(narrowRes.error.issues).toContainEqual(expect.objectContaining({ path: 'nodes[0].width' }));
      expect(h.putCanvas).not.toHaveBeenCalled();
    });

    it('refuses an empty document over an existing snapshot (409) unless allowEmpty; empty is fine with no snapshot', async () => {
      asUser(editor);
      await resetPointer({ canvasBlobPath: `canvas/${project.id}.json` });
      const refused = await put(project.id, { document: EMPTY });
      expect(refused.status).toBe(409);
      expect((await refused.json()).error).toMatchObject({ code: 'CONFLICT', reason: 'empty_document' });
      expect(h.putCanvas).not.toHaveBeenCalled();

      expect((await put(project.id, { document: EMPTY, allowEmpty: true })).status).toBe(200);
      await resetPointer();
      expect((await put(project.id, { document: EMPTY })).status).toBe(200);
      expect(h.putCanvas).toHaveBeenCalledTimes(2);
    });

    it('enforces the 10 s minimum interval per project with Retry-After (P-13-2)', async () => {
      asUser(editor);
      await resetPointer({ canvasSavedAt: new Date(Date.now() - 4_000) });
      const limited = await put(project.id, { document: small });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('Retry-After')).toBe('6');
      expect(h.putCanvas).not.toHaveBeenCalled();

      await resetPointer({ canvasSavedAt: new Date(Date.now() - 11_000) });
      expect((await put(project.id, { document: small })).status).toBe(200);
    });
  });
});
