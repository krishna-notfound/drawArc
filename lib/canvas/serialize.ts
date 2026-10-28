import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  DEFAULT_SIZES,
  type HandleId,
  type PersistedEdge,
  type PersistedNode,
} from '@/types/canvas';

function persistNode(node: CanvasNode): PersistedNode {
  // Unknown shapes (EC-001) fall back to rectangle sizes here; validation then rejects the shape itself.
  const fallback = DEFAULT_SIZES[node.data.shape] ?? DEFAULT_SIZES.rectangle;
  return {
    id: node.id,
    type: 'canvasNode',
    position: { x: node.position.x, y: node.position.y },
    width: node.width ?? node.measured?.width ?? fallback.width,
    height: node.height ?? node.measured?.height ?? fallback.height,
    // The whole `data` object: the schema's strict kind objects are the allowlist, so no v2 field is dropped.
    data: { ...node.data },
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    ...(node.extent === 'parent' ? { extent: 'parent' as const } : {}),
  };
}

function persistEdge(edge: CanvasEdge): PersistedEdge {
  const label = edge.data?.label;
  const style = edge.data?.style;
  return {
    id: edge.id,
    type: 'canvasEdge',
    source: edge.source,
    target: edge.target,
    sourceHandle: (edge.sourceHandle ?? 'right') as HandleId,
    targetHandle: (edge.targetHandle ?? 'left') as HandleId,
    ...(label || style ? { data: { ...(label ? { label } : {}), ...(style ? { style: { ...style } } : {}) } } : {}),
  };
}

/**
 * React Flow state → `CanvasDocument` by allowlist copy: runtime fields (`selected`, `dragging`, `measured`,
 * `resizing`, `style`, `className`, `zIndex`, …) are never emitted. The result is not validated here; callers
 * that persist it run `validateDocument` (F13 refuses to save invalid documents).
 */
export function toDocument(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): CanvasDocument {
  return { schemaVersion: CANVAS_SCHEMA_VERSION, nodes: nodes.map(persistNode), edges: edges.map(persistEdge) };
}

/** `CanvasDocument` → React Flow nodes and edges, adding nothing beyond the persisted fields. */
export function fromDocument(doc: CanvasDocument): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  return {
    nodes: doc.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      width: node.width,
      height: node.height,
      data: { ...node.data },
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
      ...(node.extent !== undefined ? { extent: node.extent } : {}),
    })),
    edges: doc.edges.map((edge) => ({
      id: edge.id,
      type: edge.type,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      ...(edge.data ? { data: { ...edge.data } } : {}),
    })),
  };
}
