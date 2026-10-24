import { newEdgeId } from '@/lib/canvas/ids';
import { type CanvasEdge, HANDLE_IDS, type HandleId } from '@/types/canvas';

/** The four endpoint fields React Flow hands to `isValidConnection` / `onConnect` / `onReconnect`. */
export interface Endpoints {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Both ends on the same node (any two handles of it) — never allowed (FR-004, EC-006). */
export function isSelfLoop(c: Endpoints): boolean {
  return c.source === c.target;
}

/** True when the endpoints are identical, handle for handle. */
export function sameEndpoints(a: Endpoints, b: Endpoints): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    (a.sourceHandle ?? null) === (b.sourceHandle ?? null) &&
    (a.targetHandle ?? null) === (b.targetHandle ?? null)
  );
}

/**
 * An edge with the same `(source, sourceHandle, target, targetHandle)` already exists (FR-004). The reverse
 * direction or another handle pair is a different connection. `ignoreId` excludes the edge being reconnected.
 */
export function isDuplicateConnection(c: Endpoints, edges: readonly CanvasEdge[], ignoreId?: string): boolean {
  return edges.some((e) => e.id !== ignoreId && sameEndpoints(e, c));
}

/** The connection rule used by `<ReactFlow isValidConnection>` (FR-004). */
export function isAllowedConnection(c: Endpoints, edges: readonly CanvasEdge[], ignoreId?: string): boolean {
  return !isSelfLoop(c) && !isDuplicateConnection(c, edges, ignoreId);
}

function handleId(value: string | null | undefined, end: 'source' | 'target'): HandleId {
  if (!(HANDLE_IDS as readonly (string | null | undefined)[]).includes(value)) {
    throw new Error(`[canvas] connection ${end} handle must be one of ${HANDLE_IDS.join('/')}, got ${String(value)}`);
  }
  return value as HandleId;
}

/**
 * The schema-v1 edge for a completed connection (D-09a): exactly these seven keys, nothing from React Flow's
 * `defaultEdgeOptions` (the arrowhead is a render-time default, never persisted — D-09c).
 */
export function buildEdge(c: Endpoints, id: string = newEdgeId()): CanvasEdge {
  return {
    id,
    source: c.source,
    target: c.target,
    sourceHandle: handleId(c.sourceHandle, 'source'),
    targetHandle: handleId(c.targetHandle, 'target'),
    type: 'canvasEdge',
    data: {},
  };
}
