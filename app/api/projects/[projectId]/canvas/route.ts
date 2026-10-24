import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireProjectRole } from '@/lib/access';
import { BlobCorruptError, getCanvas, putCanvas } from '@/lib/blob';
import { migrate, validateDocument } from '@/lib/canvas/schema';
import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { withRequest } from '@/lib/request-id';

/** Snapshot size cap (D-009); below Vercel's 4.5 MB function body limit. */
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
/** Minimum interval between snapshot writes per project = 6/min (P-13-2). */
const MIN_SAVE_INTERVAL_MS = 10_000;

const PutBodySchema = z.object({ document: z.unknown(), allowEmpty: z.boolean().optional() }).strict();

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

type Ctx = RouteContext<'/api/projects/[projectId]/canvas'>;

/** `['nodes', 0, 'width']` → `nodes[0].width`. */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

const tooLarge = () => new AppError('VALIDATION', 'Diagram too large to save.', { status: 422 });

/**
 * Writes the project's canvas snapshot (FR-003). Binding order: role → size → envelope → migrate → validate →
 * empty-guard → minimum interval → put → pointer update. The put and the pointer update are not atomic (R-04);
 * GET reads by pathname, so a failed pointer update only leaves a stale `savedAt` (P-13-4). Every failure is a
 * typed error, so `withRequest` answers with the standard body plus `requestId` and logs it (F15 FR-007).
 */
export const PUT = withRequest(
  async (ctx, request: Request, { params }: Ctx) => {
    const { projectId } = await params;
    const { user, project } = await requireProjectRole(projectId, 'editor');
    ctx.bind({ projectId: project.id, userId: user.id });

    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_SNAPSHOT_BYTES) throw tooLarge();
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) throw tooLarge();

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError('VALIDATION', 'Malformed JSON body.');
    }
    const body = PutBodySchema.safeParse(raw);
    if (!body.success) throw new AppError('VALIDATION', 'Invalid request body.');

    const result = validateDocument(migrate(body.data.document));
    if (!result.ok) {
      const issues = result.error.issues
        .slice(0, 50)
        .map((issue) => ({ path: formatPath(issue.path), message: issue.message }));
      throw new AppError('VALIDATION', 'The diagram failed validation.', { status: 422, details: { issues } });
    }
    const doc = result.doc;

    // P-13-1: an empty document never silently replaces an existing snapshot.
    if (doc.nodes.length === 0 && doc.edges.length === 0 && project.canvasBlobPath && !body.data.allowEmpty) {
      throw new AppError('CONFLICT', 'Refusing to replace the saved diagram with an empty canvas.', {
        details: { reason: 'empty_document' },
      });
    }

    const now = Date.now();
    if (project.canvasSavedAt) {
      const elapsed = now - project.canvasSavedAt.getTime();
      if (elapsed < MIN_SAVE_INTERVAL_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((MIN_SAVE_INTERVAL_MS - elapsed) / 1000));
        throw new AppError('RATE_LIMITED', 'Saved moments ago; retry shortly.', { details: { retryAfterSeconds } });
      }
    }

    let stored: { pathname: string; size: number };
    try {
      stored = await putCanvas(project.id, doc);
    } catch (err) {
      ctx.log.error({ op: 'putCanvas', err }, 'canvas snapshot put failed');
      throw new AppError('UPSTREAM');
    }

    const savedAt = new Date(now);
    let pointerUpdated = true;
    try {
      await prisma.project.update({
        where: { id: project.id },
        data: { canvasBlobPath: stored.pathname, canvasSavedAt: savedAt, canvasSchemaVersion: doc.schemaVersion },
        select: { id: true },
      });
    } catch (err) {
      pointerUpdated = false;
      ctx.log.error({ op: 'updatePointer', err }, 'canvas pointer update failed after a successful put');
    }

    return NextResponse.json(
      { savedAt: savedAt.toISOString(), schemaVersion: doc.schemaVersion, size: stored.size, pointerUpdated },
      { headers: NO_STORE },
    );
  },
  { headers: NO_STORE },
);

/**
 * Reads the snapshot by its deterministic pathname (FR-004, P-13-3/P-13-4), migrated and re-validated. An
 * unparseable or invalid snapshot is a 200 with `warning`, distinct from an unreachable store (502).
 */
export const GET = withRequest(
  async (ctx, _request: Request, { params }: Ctx) => {
    const { projectId } = await params;
    const { user, project } = await requireProjectRole(projectId, 'viewer');
    ctx.bind({ projectId: project.id, userId: user.id });
    const savedAt = project.canvasSavedAt?.toISOString() ?? null;
    const invalid = { document: null, savedAt, schemaVersion: null, warning: 'SNAPSHOT_INVALID' } as const;

    let stored: Awaited<ReturnType<typeof getCanvas>>;
    try {
      stored = await getCanvas(project.id);
    } catch (err) {
      if (err instanceof BlobCorruptError) {
        ctx.log.error({ op: 'getCanvas', err }, 'stored canvas snapshot is not JSON');
        return NextResponse.json(invalid, { headers: NO_STORE });
      }
      ctx.log.error({ op: 'getCanvas', err }, 'canvas snapshot read failed');
      throw new AppError('UPSTREAM');
    }
    if (!stored) return NextResponse.json({ document: null, savedAt: null, schemaVersion: null }, { headers: NO_STORE });

    const result = validateDocument(migrate(stored.json));
    if (!result.ok) {
      const issues = result.error.issues.slice(0, 5).map((issue) => `${formatPath(issue.path)}: ${issue.message}`);
      ctx.log.error({ op: 'validateSnapshot', issues }, 'stored canvas snapshot is invalid');
      return NextResponse.json(invalid, { headers: NO_STORE });
    }
    return NextResponse.json(
      { document: result.doc, savedAt, schemaVersion: result.doc.schemaVersion },
      { headers: NO_STORE },
    );
  },
  { headers: NO_STORE },
);
