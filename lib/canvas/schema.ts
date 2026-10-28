import { z } from 'zod';

import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  HANDLE_IDS,
  HANDLE_KINDS,
  HEX_COLOR_RE,
  type HexColor,
  MIN_SIZES,
  NODE_COLOR_IDS,
  NODE_KINDS,
  NODE_SHAPES,
  type NodeKind,
  TEXT_SIZES,
} from '@/types/canvas';

/**
 * The single validation boundary for canvas documents (NFR-002): snapshots (F13), templates (F14) and agent
 * output (F17) all pass through `validateDocument`. Pure TypeScript — importable from route handlers and tasks.
 */
export const MAX_NODES = 2000;
export const MAX_EDGES = 4000;
export const MAX_LABEL = 500;

const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
export const NodeIdSchema = z.string().regex(new RegExp(`^(${NODE_KINDS.join('|')})_${ULID}$`), 'Invalid node id');
export const EdgeIdSchema = z.string().regex(new RegExp(`^e_${ULID}$`), 'Invalid edge id');
const GroupIdSchema = z.string().regex(new RegExp(`^g_${ULID}$`), 'Invalid group id');
const OrderSchema = z.string().regex(/^[0-9A-Za-z]{1,64}$/, 'Invalid order key');
const HrefSchema = z.string().max(2048).regex(/^https?:\/\//, 'href must be http(s)');

/** A palette id or a `#rrggbb` hex (D-063); anything else (`#FFF`, `rgb(…)`) is rejected. */
export const ColorSchema = z.union([
  z.enum(NODE_COLOR_IDS),
  z.custom<HexColor>((value) => typeof value === 'string' && HEX_COLOR_RE.test(value), 'Invalid colour'),
]);

export const TextOptionsSchema = z
  .object({
    size: z.enum(TEXT_SIZES),
    align: z.enum(['left', 'center', 'right']),
    valign: z.enum(['top', 'middle', 'bottom']),
    bold: z.boolean(),
  })
  .strict();

export const BorderSchema = z
  .object({
    style: z.enum(['none', 'solid', 'dashed', 'dotted']),
    width: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

const MarkerSchema = z.enum(['none', 'arrow', 'arrowClosed', 'circle', 'diamond', 'bar']);
const DashSchema = z.enum(['solid', 'dashed', 'dotted']);

const StrokeStyleSchema = z
  .object({
    dash: DashSchema,
    width: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    markerStart: MarkerSchema,
    markerEnd: MarkerSchema,
  })
  .strict();

export const EdgeStyleSchema = z
  .object({
    path: z.enum(['smoothstep', 'step', 'straight', 'bezier']),
    dash: DashSchema,
    width: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    markerStart: MarkerSchema,
    markerEnd: MarkerSchema,
  })
  .strict();

const common = {
  label: z.string().max(MAX_LABEL),
  color: ColorSchema,
  text: TextOptionsSchema.optional(),
  border: BorderSchema.optional(),
  locked: z.boolean().optional(),
  groupId: GroupIdSchema.optional(),
  order: OrderSchema.optional(),
  href: HrefSchema.optional(),
};

/** Discriminated on `shape`; every object is strict so a `rectangle` with `points` is rejected with a path. */
export const NodeDataSchema = z.discriminatedUnion('shape', [
  z.object({ ...common, shape: z.enum(NODE_SHAPES) }).strict(),
  z.object({ ...common, shape: z.literal('text'), autoWidth: z.boolean() }).strict(),
  z.object({ ...common, shape: z.literal('sticky') }).strict(),
  z
    .object({
      ...common,
      shape: z.literal('line'),
      points: z.array(z.tuple([z.number(), z.number()])).min(2).max(100),
      stroke: StrokeStyleSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      shape: z.literal('freehand'),
      points: z.array(z.tuple([z.number(), z.number(), z.number()])).max(2000),
      strokeWidth: z.number().min(2).max(16),
    })
    .strict(),
  z.object({ ...common, shape: z.literal('frame'), clip: z.boolean() }).strict(),
  z
    .object({
      ...common,
      shape: z.literal('image'),
      image: z
        .object({
          fileId: z.string().min(1).max(256),
          status: z.enum(['pending', 'saved', 'error']),
          natural: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
        })
        .strict(),
    })
    .strict(),
]);

export const PersistedNodeSchema = z
  .object({
    id: NodeIdSchema,
    type: z.literal('canvasNode'),
    position: z.object({ x: z.number(), y: z.number() }).strict(),
    width: z.number(),
    height: z.number(),
    data: NodeDataSchema,
    parentId: NodeIdSchema.optional(),
    extent: z.literal('parent').optional(),
  })
  .strict()
  .superRefine((node, ctx) => {
    const min = MIN_SIZES[node.data.shape];
    if (node.width < min.width) {
      ctx.addIssue({ code: 'custom', path: ['width'], message: `Width must be at least ${min.width}` });
    }
    if (node.height < min.height) {
      ctx.addIssue({ code: 'custom', path: ['height'], message: `Height must be at least ${min.height}` });
    }
    if (node.id.split('_')[0] !== node.data.shape) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: `Node id prefix must match shape ${node.data.shape}` });
    }
  });

export const PersistedEdgeSchema = z
  .object({
    id: EdgeIdSchema,
    type: z.literal('canvasEdge'),
    source: NodeIdSchema,
    target: NodeIdSchema,
    sourceHandle: z.enum(HANDLE_IDS),
    targetHandle: z.enum(HANDLE_IDS),
    data: z.object({ label: z.string().max(MAX_LABEL).optional(), style: EdgeStyleSchema.optional() }).strict().optional(),
  })
  .strict();

// Zod 4 numbers reject NaN and ±Infinity, so positions and sizes are finite without `.finite()`.
export const CanvasDocumentSchema = z
  .object({
    schemaVersion: z.literal(CANVAS_SCHEMA_VERSION),
    nodes: z.array(PersistedNodeSchema).max(MAX_NODES),
    edges: z.array(PersistedEdgeSchema).max(MAX_EDGES),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const kinds = new Map<string, NodeKind>();
    doc.nodes.forEach((node, i) => {
      if (kinds.has(node.id)) {
        ctx.addIssue({ code: 'custom', path: ['nodes', i, 'id'], message: `Duplicate node id ${node.id}` });
      }
      kinds.set(node.id, node.data.shape);
    });
    doc.nodes.forEach((node, i) => {
      if (node.parentId === undefined) return;
      if (node.data.shape === 'frame') {
        ctx.addIssue({ code: 'custom', path: ['nodes', i, 'parentId'], message: 'A frame cannot have a parent' });
      } else if (kinds.get(node.parentId) !== 'frame') {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', i, 'parentId'],
          message: `parentId ${node.parentId} must reference a frame node`,
        });
      }
    });
    const edgeIds = new Set<string>();
    doc.edges.forEach((edge, i) => {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'id'], message: `Duplicate edge id ${edge.id}` });
      }
      edgeIds.add(edge.id);
      for (const end of ['source', 'target'] as const) {
        const kind = kinds.get(edge[end]);
        if (kind === undefined) {
          ctx.addIssue({ code: 'custom', path: ['edges', i, end], message: `Edge ${edge.id} references missing node ${edge[end]}` });
        } else if (!(HANDLE_KINDS as readonly string[]).includes(kind)) {
          ctx.addIssue({ code: 'custom', path: ['edges', i, end], message: `Edge ${edge.id} cannot connect a ${kind} node` });
        }
      }
      if (edge.source === edge.target) {
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'target'], message: `Edge ${edge.id} is a self-loop` });
      }
    });
  });

export type CanvasDocumentParsed = z.infer<typeof CanvasDocumentSchema>;

/** v1 → v2 is a pure version stamp: every v2 field is optional with a per-kind default (D-22d). */
export function migrateV1ToV2(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...structuredClone(doc), schemaVersion: 2 };
}

/**
 * Migrations from version n to n + 1, keyed by n. Adding v3 means: bump `CANVAS_SCHEMA_VERSION`, export
 * `migrateV2ToV3`, register it here, and add `tests/fixtures/canvas/v2-*.json` (schema-freeze test).
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = { 1: migrateV1ToV2 };

/**
 * Brings a stored document up to `CANVAS_SCHEMA_VERSION`. Unknown shapes, missing versions and versions newer
 * than this app are returned unchanged — `validateDocument` then rejects them (EC-012: "newer version required").
 */
export function migrate(doc: unknown): unknown {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return doc;
  let current = doc as Record<string, unknown>;
  let version = current.schemaVersion;
  while (typeof version === 'number' && version < CANVAS_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return current;
    current = step(current);
    version = current.schemaVersion;
  }
  return current;
}

export type ValidateResult = { ok: true; doc: CanvasDocument } | { ok: false; error: z.ZodError };

/** Validates an already-migrated document. */
export function validateDocument(input: unknown): ValidateResult {
  const result = CanvasDocumentSchema.safeParse(input);
  return result.success ? { ok: true, doc: result.data } : { ok: false, error: result.error };
}
