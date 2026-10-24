import { z } from 'zod';

import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  HANDLE_IDS,
  MIN_SIZE,
  NODE_COLOR_IDS,
  NODE_SHAPES,
} from '@/types/canvas';

/**
 * The single validation boundary for canvas documents (NFR-002): snapshots (F13), templates (F14) and agent
 * output (F17) all pass through `validateDocument`. Pure TypeScript — importable from route handlers and tasks.
 */
export const MAX_NODES = 2000;
export const MAX_EDGES = 4000;
export const MAX_LABEL = 500;

const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
export const NodeIdSchema = z.string().regex(new RegExp(`^(${NODE_SHAPES.join('|')})_${ULID}$`), 'Invalid node id');
export const EdgeIdSchema = z.string().regex(new RegExp(`^e_${ULID}$`), 'Invalid edge id');

export const PersistedNodeSchema = z
  .object({
    id: NodeIdSchema,
    type: z.literal('canvasNode'),
    position: z.object({ x: z.number(), y: z.number() }).strict(),
    width: z.number().min(MIN_SIZE.width),
    height: z.number().min(MIN_SIZE.height),
    data: z
      .object({ label: z.string().max(MAX_LABEL), shape: z.enum(NODE_SHAPES), color: z.enum(NODE_COLOR_IDS) })
      .strict(),
  })
  .strict();

export const PersistedEdgeSchema = z
  .object({
    id: EdgeIdSchema,
    type: z.literal('canvasEdge'),
    source: NodeIdSchema,
    target: NodeIdSchema,
    sourceHandle: z.enum(HANDLE_IDS),
    targetHandle: z.enum(HANDLE_IDS),
    data: z.object({ label: z.string().max(MAX_LABEL).optional() }).strict().optional(),
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
    const nodeIds = new Set<string>();
    doc.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({ code: 'custom', path: ['nodes', i, 'id'], message: `Duplicate node id ${node.id}` });
      }
      nodeIds.add(node.id);
    });
    const edgeIds = new Set<string>();
    doc.edges.forEach((edge, i) => {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'id'], message: `Duplicate edge id ${edge.id}` });
      }
      edgeIds.add(edge.id);
      for (const end of ['source', 'target'] as const) {
        if (!nodeIds.has(edge[end])) {
          ctx.addIssue({ code: 'custom', path: ['edges', i, end], message: `Edge ${edge.id} references missing node ${edge[end]}` });
        }
      }
      if (edge.source === edge.target) {
        ctx.addIssue({ code: 'custom', path: ['edges', i, 'target'], message: `Edge ${edge.id} is a self-loop` });
      }
    });
  });

export type CanvasDocumentParsed = z.infer<typeof CanvasDocumentSchema>;

/**
 * Migrations from version n to n + 1, keyed by n. Empty for v1. Adding v2 means: bump `CANVAS_SCHEMA_VERSION`,
 * export `migrateV1ToV2`, register it here, and add `tests/fixtures/canvas/v1-*.json` (P-06-6, schema-freeze test).
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

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
