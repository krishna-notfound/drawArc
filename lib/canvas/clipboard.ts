import type { XYPosition } from '@xyflow/react';
import { z } from 'zod';

import { newEdgeId, newNodeId } from '@/lib/canvas/ids';
import { migrate, PersistedEdgeSchema, PersistedNodeSchema } from '@/lib/canvas/schema';
import { fromDocument, toDocument } from '@/lib/canvas/serialize';
import { CANVAS_SCHEMA_VERSION, type CanvasEdge, type CanvasNode } from '@/types/canvas';

/**
 * F10 v2 clipboard (FR-016/017, D-10f). The system clipboard carries a `text/plain` JSON envelope, and the same text
 * is always kept in memory so a denied or missing Clipboard API never loses a copy. Pure: no React.
 */
export const CLIPBOARD_TYPE = 'drawarc-clipboard';
export const CLIPBOARD_MAX_CHARS = 1_000_000;
export const CLIPBOARD_MAX_NODES = 500;
export const CLIPBOARD_MAX_EDGES = 1_000;

export const ClipboardEnvelopeSchema = z
  .object({
    type: z.literal(CLIPBOARD_TYPE),
    schemaVersion: z.number().int().min(1).max(CANVAS_SCHEMA_VERSION),
    nodes: z.array(PersistedNodeSchema).max(CLIPBOARD_MAX_NODES),
    edges: z.array(PersistedEdgeSchema).max(CLIPBOARD_MAX_EDGES),
  })
  .strict();
export type ClipboardEnvelope = z.infer<typeof ClipboardEnvelopeSchema>;

export type ParsedClipboard =
  | { kind: 'envelope'; envelope: ClipboardEnvelope }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

/** Selected nodes and the edges whose both ends are selected, as persisted fields only (runtime keys never leave). */
export function serializeSelection(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): ClipboardEnvelope {
  const selected = nodes.filter((n) => n.selected);
  const ids = new Set(selected.map((n) => n.id));
  const internal = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const doc = toDocument(selected, internal);
  return { type: CLIPBOARD_TYPE, schemaVersion: doc.schemaVersion, nodes: doc.nodes, edges: doc.edges };
}

/**
 * Over the cap or blank → none; an object with `type: 'drawarc-clipboard'` must pass migrate + strict validation,
 * else none (a broken envelope must never become a 1 MB text node); anything else is plain text (FR-018).
 */
export function parseClipboardText(text: string): ParsedClipboard {
  if (text.length > CLIPBOARD_MAX_CHARS) return { kind: 'none' };
  if (text.trim() === '') return { kind: 'none' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'text', text };
  }
  if (typeof json === 'object' && json !== null && !Array.isArray(json) && (json as { type?: unknown }).type === CLIPBOARD_TYPE) {
    const parsed = ClipboardEnvelopeSchema.safeParse(migrate(json));
    return parsed.success ? { kind: 'envelope', envelope: parsed.data } : { kind: 'none' };
  }
  return { kind: 'text', text };
}

/**
 * Fresh ids for every node and edge, endpoints remapped, edges to nodes outside the envelope dropped, the group
 * translated so its bounding-box centre sits on `centre`. Relative layout is kept; nothing is rounded to the grid.
 */
export function placePasted(env: ClipboardEnvelope, centre: XYPosition): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const { nodes, edges } = fromDocument({ schemaVersion: CANVAS_SCHEMA_VERSION, nodes: env.nodes, edges: env.edges });
  if (nodes.length === 0) return { nodes: [], edges: [] };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of env.nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + n.width);
    maxY = Math.max(maxY, n.position.y + n.height);
  }
  const dx = centre.x - (minX + maxX) / 2;
  const dy = centre.y - (minY + maxY) / 2;
  const idMap = new Map<string, string>();
  const placed = nodes.map((n): CanvasNode => {
    const id = newNodeId(n.data.shape);
    idMap.set(n.id, id);
    return { ...n, id, position: { x: n.position.x + dx, y: n.position.y + dy } };
  });
  const placedEdges = edges.flatMap((e): CanvasEdge[] => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    return source && target ? [{ ...e, id: newEdgeId(), source, target }] : [];
  });
  return { nodes: placed, edges: placedEdges };
}

/** The last text this tab copied; survives a missing or denied Clipboard API (EC-014, EC-015). */
export const memoryClipboard: { text: string | null } = { text: null };

export async function writeClipboardText(text: string): Promise<void> {
  memoryClipboard.text = text;
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // Permission denied or unavailable: the in-memory copy still serves paste.
  }
}

export async function readClipboardText(): Promise<string | null> {
  try {
    const text = await navigator.clipboard?.readText();
    if (text) return text;
  } catch {
    // Permission denied or unavailable: fall back to the in-memory copy.
  }
  return memoryClipboard.text;
}
