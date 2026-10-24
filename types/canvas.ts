import type { Edge, Node } from '@xyflow/react';

/**
 * Canvas schema v1 (context/domain-model.md "Canvas schema v1"), FROZEN on approval of F06 (P-06-6). Any change
 * to the persisted shape bumps `CANVAS_SCHEMA_VERSION`, adds `migrateV{n}ToV{n+1}` in `lib/canvas/schema.ts`, a
 * fixture `tests/fixtures/canvas/v{n}-*.json`, and a decision-log entry.
 */
export const CANVAS_SCHEMA_VERSION = 1 as const;

export const NODE_SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export const NODE_COLOR_IDS = ['neutral', 'blue', 'purple', 'orange', 'red', 'pink', 'green', 'teal'] as const;
export type NodeColorId = (typeof NODE_COLOR_IDS)[number];

/** Palette pairs from context/ui-context.md; colours are stored by id so the palette can be retuned. */
export const NODE_COLORS: Record<NodeColorId, { fill: string; text: string }> = {
  neutral: { fill: '#1F1F1F', text: '#EDEDED' },
  blue: { fill: '#10233D', text: '#52A8FF' },
  purple: { fill: '#2E1938', text: '#BF7AF0' },
  orange: { fill: '#331B00', text: '#FF990A' },
  red: { fill: '#3C1618', text: '#FF6166' },
  pink: { fill: '#3A1726', text: '#F75F8F' },
  green: { fill: '#0F2E18', text: '#62C073' },
  teal: { fill: '#062822', text: '#0AC7B4' },
};

export const HANDLE_IDS = ['top', 'right', 'bottom', 'left'] as const;
export type HandleId = (typeof HANDLE_IDS)[number];

export const DEFAULT_SIZES: Record<NodeShape, { width: number; height: number }> = {
  rectangle: { width: 180, height: 80 },
  pill: { width: 180, height: 64 },
  circle: { width: 96, height: 96 },
  diamond: { width: 140, height: 140 },
  cylinder: { width: 140, height: 110 },
  hexagon: { width: 160, height: 110 },
};

export const MIN_SIZE = { width: 48, height: 32 } as const;

/** UX cap on a node label, enforced by the F08 editor; looser than the schema bound (`MAX_LABEL`) on purpose. */
export const LABEL_MAX_LENGTH = 200;

// Type aliases (not interfaces) so they satisfy React Flow's `Record<string, unknown>` data constraint.
export type CanvasNodeData = { label: string; shape: NodeShape; color: NodeColorId };
export type CanvasNode = Node<CanvasNodeData, 'canvasNode'>;

export type CanvasEdgeData = { label?: string };
export type CanvasEdge = Edge<CanvasEdgeData, 'canvasEdge'>;

/** A `CanvasNode` minus runtime fields; `width`/`height` are always set when persisted. */
export interface PersistedNode {
  id: string;
  type: 'canvasNode';
  position: { x: number; y: number };
  width: number;
  height: number;
  data: CanvasNodeData;
}

/** A `CanvasEdge` minus runtime fields; both handles are required when persisted. */
export interface PersistedEdge {
  id: string;
  type: 'canvasEdge';
  source: string;
  target: string;
  sourceHandle: HandleId;
  targetHandle: HandleId;
  data?: CanvasEdgeData;
}

export interface CanvasDocument {
  schemaVersion: typeof CANVAS_SCHEMA_VERSION;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}
