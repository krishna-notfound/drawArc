import type { Edge, Node } from '@xyflow/react';

/**
 * Canvas schema v2 (context/domain-model.md "Canvas schema v2"), frozen at F22 approval (D-057, D-066). Any change
 * to the persisted shape bumps `CANVAS_SCHEMA_VERSION`, adds `migrateV{n}ToV{n+1}` in `lib/canvas/schema.ts`, a
 * fixture `tests/fixtures/canvas/v{n}-*.json`, and a decision-log entry.
 */
export const CANVAS_SCHEMA_VERSION = 2 as const;

export const NODE_SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

/** Every `data.shape` the schema accepts; `NODE_SHAPES` (the F07 palette) stays the six drawn shapes. */
export const NODE_KINDS = [...NODE_SHAPES, 'text', 'sticky', 'line', 'freehand', 'frame', 'image'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
/** Kinds that can be edge endpoints. */
export const HANDLE_KINDS = [...NODE_SHAPES, 'sticky', 'image'] as const;
/** Kinds whose `data.text` the F08 v2 properties toolbar edits (reserved kinds excluded). */
export const TEXT_OPTION_KINDS = [...NODE_SHAPES, 'text', 'sticky'] as const;
/** Kinds the shape palette can create. */
export type PaletteKind = NodeShape | 'text' | 'sticky';

export function isNodeShape(kind: string): kind is NodeShape {
  return (NODE_SHAPES as readonly string[]).includes(kind);
}
export function isNodeKind(kind: string): kind is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(kind);
}

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

export type HexColor = `#${string}`;
/** A palette id or a validated `#rrggbb` (D-063). */
export type NodeColor = NodeColorId | HexColor;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
/** Derived text colours for hex fills: pure white or black by WCAG luminance (F08 D-08g). */
export const PURE_TEXT = { light: '#FFFFFF', dark: '#000000' } as const;
/** `--bg-base` (app/globals.css); the contrast reference for borderless text. */
export const BG_BASE_HEX = '#080809';

export const HANDLE_IDS = ['top', 'right', 'bottom', 'left'] as const;
export type HandleId = (typeof HANDLE_IDS)[number];

export const DEFAULT_SIZES: Record<NodeKind, { width: number; height: number }> = {
  rectangle: { width: 180, height: 80 },
  pill: { width: 180, height: 64 },
  circle: { width: 96, height: 96 },
  diamond: { width: 140, height: 140 },
  cylinder: { width: 140, height: 110 },
  hexagon: { width: 160, height: 110 },
  text: { width: 24, height: 20 },
  sticky: { width: 250, height: 250 },
  line: { width: 100, height: 100 },
  freehand: { width: 100, height: 100 },
  frame: { width: 400, height: 300 },
  image: { width: 200, height: 150 },
};

export const MIN_SIZES: Record<NodeKind, { width: number; height: number }> = {
  rectangle: { width: 48, height: 32 },
  pill: { width: 48, height: 32 },
  circle: { width: 48, height: 32 },
  diamond: { width: 48, height: 32 },
  cylinder: { width: 48, height: 32 },
  hexagon: { width: 48, height: 32 },
  text: { width: 24, height: 20 },
  sticky: { width: 75, height: 75 },
  line: { width: 48, height: 32 },
  freehand: { width: 48, height: 32 },
  frame: { width: 48, height: 32 },
  image: { width: 48, height: 32 },
};

export const TEXT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_PX = { s: 12, m: 14, l: 20, xl: 28 } as const satisfies Record<TextSize, number>;
export type TextOptions = {
  size: TextSize;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  bold: boolean;
};
export type BorderOptions = { style: 'none' | 'solid' | 'dashed' | 'dotted'; width: 1 | 2 | 3 };

const CENTRED: TextOptions = { size: 'm', align: 'center', valign: 'middle', bold: false };
const LEFT_TOP: TextOptions = { size: 'm', align: 'left', valign: 'top', bold: false };
/** Effective text options are `data.text ?? DEFAULT_TEXT[kind]`; defaults are never stored. */
export const DEFAULT_TEXT: Record<NodeKind, TextOptions> = {
  rectangle: CENTRED,
  diamond: CENTRED,
  circle: CENTRED,
  pill: CENTRED,
  cylinder: CENTRED,
  hexagon: CENTRED,
  text: LEFT_TOP,
  sticky: LEFT_TOP,
  line: CENTRED,
  freehand: CENTRED,
  frame: CENTRED,
  image: CENTRED,
};

const NO_BORDER: BorderOptions = { style: 'none', width: 1 };
const SOLID_BORDER: BorderOptions = { style: 'solid', width: 1 };
export const DEFAULT_BORDER: Record<NodeKind, BorderOptions> = {
  rectangle: SOLID_BORDER,
  diamond: SOLID_BORDER,
  circle: SOLID_BORDER,
  pill: SOLID_BORDER,
  cylinder: SOLID_BORDER,
  hexagon: SOLID_BORDER,
  text: NO_BORDER,
  sticky: NO_BORDER,
  line: NO_BORDER,
  freehand: NO_BORDER,
  frame: NO_BORDER,
  image: NO_BORDER,
};

/** Edge stroke and arrowhead colour (ui-context "Edges"); SVG marker attributes cannot read CSS variables. */
export const EDGE_STROKE = '#f8fafc';
/** UX cap of the inline edge label input; the schema bound at the persistence boundary is looser (MAX_LABEL). */
export const EDGE_LABEL_MAX_LENGTH = 100;
/** UX cap on a node label, enforced by the F08 editor; looser than the schema bound (`MAX_LABEL`) on purpose. */
export const LABEL_MAX_LENGTH = 200;
/** UX cap on a text or sticky label; equal to the schema bound (`MAX_LABEL`). */
export const TEXT_MAX_LENGTH = 500;

export type MarkerKind = 'none' | 'arrow' | 'arrowClosed' | 'circle' | 'diamond' | 'bar';
export type StrokeStyle = {
  dash: 'solid' | 'dashed' | 'dotted';
  width: 1 | 2 | 3 | 4;
  markerStart: MarkerKind;
  markerEnd: MarkerKind;
};
export type EdgeStyle = {
  path: 'smoothstep' | 'step' | 'straight' | 'bezier';
  dash: 'solid' | 'dashed' | 'dotted';
  width: 1 | 2 | 3;
  markerStart: MarkerKind;
  markerEnd: MarkerKind;
};
export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  path: 'smoothstep',
  dash: 'solid',
  width: 2,
  markerStart: 'none',
  markerEnd: 'arrowClosed',
};

// Type aliases (not interfaces) so they satisfy React Flow's `Record<string, unknown>` data constraint.
type CommonData = {
  label: string;
  color: NodeColor;
  text?: TextOptions;
  border?: BorderOptions;
  locked?: boolean;
  groupId?: string;
  order?: string;
  href?: string;
};
export type ShapeData = CommonData & { shape: NodeShape };
export type TextData = CommonData & { shape: 'text'; autoWidth: boolean };
export type StickyData = CommonData & { shape: 'sticky' };
export type LineData = CommonData & { shape: 'line'; points: [number, number][]; stroke?: StrokeStyle };
export type FreehandData = CommonData & { shape: 'freehand'; points: [number, number, number][]; strokeWidth: number };
export type FrameData = CommonData & { shape: 'frame'; clip: boolean };
export type ImageData = CommonData & {
  shape: 'image';
  image: { fileId: string; status: 'pending' | 'saved' | 'error'; natural: { width: number; height: number } };
};
export type CanvasNodeData = ShapeData | TextData | StickyData | LineData | FreehandData | FrameData | ImageData;
/** The fields every kind shares; what `updateNodeData(s)` merges (F08 v2 writes `text`, `border`, `color`, …). */
export type NodeDataPatch = Partial<
  Pick<ShapeData, 'label' | 'color' | 'text' | 'border' | 'locked' | 'groupId' | 'order' | 'href'>
>;
export type CanvasNode = Node<CanvasNodeData, 'canvasNode'>;

export type CanvasEdgeData = { label?: string; style?: EdgeStyle };
export type CanvasEdge = Edge<CanvasEdgeData, 'canvasEdge'>;

/** A `CanvasNode` minus runtime fields; `width`/`height` are always set when persisted. */
export interface PersistedNode {
  id: string;
  type: 'canvasNode';
  position: { x: number; y: number };
  width: number;
  height: number;
  data: CanvasNodeData;
  parentId?: string;
  extent?: 'parent';
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
