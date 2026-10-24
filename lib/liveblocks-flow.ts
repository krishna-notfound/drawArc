import 'server-only';

import { LiveblocksError } from '@liveblocks/node';
import { mutateFlow } from '@liveblocks/react-flow/node';

import { getCanvas } from '@/lib/blob';
import { migrate, validateDocument } from '@/lib/canvas/schema';
import { fromDocument } from '@/lib/canvas/serialize';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

import { getLiveblocks } from './liveblocks';
import { logger } from './logger';

/** The React Flow subtree's Storage key; must equal `FLOW_OPTIONS.storageKey` in `flow-canvas.tsx` (F06). */
export const FLOW_STORAGE_KEY = 'flow';

/** What the workspace gate passes to the seed step (D-034); taken from the authorized project row. */
export interface SeedInput {
  id: string;
  canvasBlobPath: string | null;
  canvasSchemaVersion: number | null;
  canvasSavedAt?: Date | null;
}

/** FR-016: the seed step never throws; failures become `warning`. */
export interface SeedResult {
  seeded: boolean;
  snapshotExists: boolean;
  savedAt: string | null;
  warning: 'SEED_FAILED' | 'SNAPSHOT_INVALID' | null;
}

export interface SeedContext {
  userId: string;
  requestId?: string;
}

function countEntries(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length;
  return 0;
}

/**
 * Node and edge counts of the room's React Flow subtree. Storage JSON shape (F05 spike):
 * `{ flow: { nodes: { [id]: Node }, edges: { [id]: Edge } } }`; a room nobody has edited has no `flow` key.
 * A room that does not exist yet (projects created before F05) is created and reported empty.
 */
export async function readFlowCounts(roomId: string): Promise<{ nodes: number; edges: number }> {
  const client = getLiveblocks();
  let storage: Record<string, unknown>;
  try {
    storage = (await client.getStorageDocument(roomId, 'json')) as Record<string, unknown>;
  } catch (err) {
    if (!(err instanceof LiveblocksError) || err.status !== 404) throw err;
    await client.getOrCreateRoom(roomId, { defaultAccesses: [] });
    return { nodes: 0, edges: 0 };
  }
  const flow = storage[FLOW_STORAGE_KEY] as { nodes?: unknown; edges?: unknown } | undefined;
  return { nodes: countEntries(flow?.nodes), edges: countEntries(flow?.edges) };
}

/**
 * Seeds an empty room from the project's Blob snapshot (FR-010, D-034), server-side, before the workspace
 * renders. A non-empty room is never touched (the room always wins). The write is one synchronous `mutateFlow`
 * pass; `addNode`/`addEdge` upsert by id, so two concurrent opens converge on one copy (EC-017). Never throws.
 */
export async function seedRoomIfEmpty(project: SeedInput, ctx: SeedContext): Promise<SeedResult> {
  const savedAt = project.canvasSavedAt?.toISOString() ?? null;
  if (project.canvasBlobPath === null) return { seeded: false, snapshotExists: false, savedAt: null, warning: null };

  const log = { projectId: project.id, userId: ctx.userId, requestId: ctx.requestId };
  const started = performance.now();
  let step = 'getStorageDocument';
  try {
    const counts = await readFlowCounts(project.id);
    if (counts.nodes > 0 || counts.edges > 0) return { seeded: false, snapshotExists: true, savedAt, warning: null };

    step = 'getCanvas';
    let stored: Awaited<ReturnType<typeof getCanvas>>;
    try {
      stored = await getCanvas(project.id);
    } catch (err) {
      if (err instanceof Error && err.name === 'BlobCorruptError') {
        logger.error({ ...log, step, err }, 'seed: stored canvas snapshot is not JSON');
        return { seeded: false, snapshotExists: true, savedAt, warning: 'SNAPSHOT_INVALID' };
      }
      throw err;
    }
    // Pointer set but no blob (e.g. deleted out of band): nothing to restore.
    if (!stored) return { seeded: false, snapshotExists: false, savedAt: null, warning: null };

    const result = validateDocument(migrate(stored.json));
    if (!result.ok) {
      const issues = result.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      logger.error({ ...log, step: 'validate', issues }, 'seed: stored canvas snapshot is invalid');
      return { seeded: false, snapshotExists: true, savedAt, warning: 'SNAPSHOT_INVALID' };
    }

    step = 'mutateFlow';
    const { nodes, edges } = fromDocument(result.doc);
    await mutateFlow<CanvasNode, CanvasEdge>(
      { client: getLiveblocks(), roomId: project.id, storageKey: FLOW_STORAGE_KEY },
      (flow) => {
        for (const node of nodes) flow.addNode(node);
        for (const edge of edges) flow.addEdge(edge);
      },
    );
    logger.info({ ...log, nodes: nodes.length, edges: edges.length, 'seed.ms': Math.round(performance.now() - started) }, 'seed: room restored from snapshot');
    return { seeded: true, snapshotExists: true, savedAt, warning: null };
  } catch (err) {
    logger.error({ ...log, step, err }, 'seed: room could not be restored');
    return { seeded: false, snapshotExists: true, savedAt, warning: 'SEED_FAILED' };
  }
}
