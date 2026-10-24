import { newEdgeId, newNodeId } from '@/lib/canvas/ids';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

export interface Duplicated {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Original node id → copy id. */
  idMap: Map<string, string>;
}

/**
 * Copies `selected` nodes with new ids, offset by `offset`, and the edges among them (D-10d: an edge is copied only
 * when both its ends are copied). Runtime-only React Flow keys never reach the copies, so nothing local is written
 * to Storage; `data` is cloned so a copy never shares an object with its original.
 */
export function duplicateSelection(
  selected: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  offset = { x: 20, y: 20 },
): Duplicated {
  const idMap = new Map<string, string>();
  const nodes = selected.map((node): CanvasNode => {
    const id = newNodeId(node.data.shape);
    idMap.set(node.id, id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping runtime-only keys
    const { selected: _s, dragging: _d, measured: _m, resizing: _r, ...rest } = node;
    return {
      ...rest,
      id,
      position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      data: { ...node.data },
    };
  });
  const copiedEdges = edges.flatMap((edge): CanvasEdge[] => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) return [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the runtime-only key
    const { selected: _s, ...rest } = edge;
    return [{ ...rest, id: newEdgeId(), source, target, ...(edge.data ? { data: { ...edge.data } } : {}) }];
  });
  return { nodes, edges: copiedEdges, idMap };
}
