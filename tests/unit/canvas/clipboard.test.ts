import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type ClipboardEnvelope,
  memoryClipboard,
  parseClipboardText,
  placePasted,
  readClipboardText,
  serializeSelection,
  writeClipboardText,
} from '@/lib/canvas/clipboard';
import type { CanvasEdge, CanvasNode, HandleId, NodeShape, PersistedEdge, PersistedNode } from '@/types/canvas';

const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
/** A syntactically valid 26-character ULID ending in `suffix`. */
const ulidEnding = (suffix: string) => '01JBE'.padEnd(26 - suffix.length, '0') + suffix;

function pnode(id: string, x: number, y: number, width: number, height: number, shape: NodeShape = 'rectangle'): PersistedNode {
  return { id, type: 'canvasNode', position: { x, y }, width, height, data: { label: id.slice(-2), shape, color: 'neutral' } };
}
function pedge(id: string, source: string, target: string): PersistedEdge {
  return { id, type: 'canvasEdge', source, target, sourceHandle: 'right' as HandleId, targetHandle: 'left' as HandleId };
}
const node = (p: PersistedNode): CanvasNode => ({ ...p, data: { ...p.data } });
const edge = (p: PersistedEdge): CanvasEdge => ({ ...p });

const N1 = pnode(`rectangle_${ulidEnding('N1')}`, 0, 0, 180, 80);
const N2 = pnode(`circle_${ulidEnding('N2')}`, 200, 100, 96, 96, 'circle');
const Z = pnode(`rectangle_${ulidEnding('ZZ')}`, 500, 500, 100, 50);
const E1 = pedge(`e_${ulidEnding('E1')}`, N1.id, N2.id);
const E2 = pedge(`e_${ulidEnding('E2')}`, N1.id, `rectangle_${ulidEnding('GH')}`); // ghost target, not in the envelope
const env = { type: 'drawarc-clipboard', schemaVersion: 1, nodes: [N1, N2], edges: [E1, E2] } as const;

afterEach(() => {
  vi.unstubAllGlobals();
  memoryClipboard.text = null;
});

describe('clipboard core (F10 v2)', () => {
  it('placePasted re-ids, remaps, drops dangling edges, keeps the offset and centres the group (AC-030)', () => {
    const a = placePasted(env as unknown as ClipboardEnvelope, { x: 1000, y: 500 });
    expect(a.nodes.map((n) => n.id)).toEqual([
      expect.stringMatching(new RegExp(`^rectangle_${ULID}$`)),
      expect.stringMatching(new RegExp(`^circle_${ULID}$`)),
    ]);
    expect(a.nodes[1].position.x - a.nodes[0].position.x).toBe(200);
    expect(a.nodes[1].position.y - a.nodes[0].position.y).toBe(100);
    // bbox of N1 (0..180, 0..80) ∪ N2 (200..296, 100..196) → centre (148, 98); after translation the centre is (1000, 500)
    expect(a.nodes[0].position).toEqual({ x: 1000 - 148, y: 500 - 98 });
    expect(a.edges).toHaveLength(1);
    expect(a.edges[0]).toMatchObject({
      id: expect.stringMatching(new RegExp(`^e_${ULID}$`)),
      source: a.nodes[0].id,
      target: a.nodes[1].id,
    });
    const b = placePasted(env as unknown as ClipboardEnvelope, { x: 1000, y: 500 });
    expect(new Set([...a.nodes, ...b.nodes].map((n) => n.id)).size).toBe(4);
    for (const n of a.nodes) expect(Object.keys(n).sort()).toEqual(['data', 'height', 'id', 'position', 'type', 'width']);
  });

  it('parseClipboardText: cap → none, prose → text, v1 envelope → envelope, broken envelope → none (AC-030, AC-031, EC-016, EC-017)', () => {
    expect(parseClipboardText('x'.repeat(1_000_001))).toEqual({ kind: 'none' });
    expect(parseClipboardText('   ')).toEqual({ kind: 'none' });
    expect(parseClipboardText('hello')).toEqual({ kind: 'text', text: 'hello' });
    expect(parseClipboardText('{"type":"other"}')).toEqual({ kind: 'text', text: '{"type":"other"}' });
    expect(parseClipboardText(JSON.stringify(env)).kind).toBe('envelope');
    expect(parseClipboardText(JSON.stringify({ ...env, schemaVersion: 99 }))).toEqual({ kind: 'none' });
    const many = Array.from({ length: 501 }, (_, i) => pnode(`rectangle_${ulidEnding(String(i).padStart(3, '0'))}`, i, 0, 100, 50));
    expect(parseClipboardText(JSON.stringify({ ...env, nodes: many }))).toEqual({ kind: 'none' });
    expect(parseClipboardText(JSON.stringify({ ...env, nodes: [{ ...N1, extra: 1 }] }))).toEqual({ kind: 'none' });
  });

  it('serializeSelection keeps only selected nodes and internal edges, with runtime keys stripped (AC-028 unit)', () => {
    const out = serializeSelection(
      [
        { ...node(N1), selected: true, dragging: true, measured: { width: 1, height: 1 } },
        { ...node(N2), selected: true },
        { ...node(Z), selected: false },
      ],
      [edge(E1), edge(pedge(E2.id, N1.id, Z.id))],
    );
    // F22: the live canvas schema is v2; a v1 envelope still parses (line 34 fixture) through migrate.
    expect(out).toEqual({ type: 'drawarc-clipboard', schemaVersion: 2, nodes: [N1, N2], edges: [E1] });
  });

  it('writeClipboardText/readClipboardText survive a missing or rejecting navigator.clipboard (AC-029, EC-014, EC-015)', async () => {
    vi.stubGlobal('navigator', {});
    await expect(writeClipboardText('t1')).resolves.toBeUndefined();
    expect(memoryClipboard.text).toBe('t1');
    await expect(readClipboardText()).resolves.toBe('t1');
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')), readText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await expect(writeClipboardText('t2')).resolves.toBeUndefined();
    await expect(readClipboardText()).resolves.toBe('t2');
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockResolvedValue('') } });
    await expect(readClipboardText()).resolves.toBe('t2');
    memoryClipboard.text = null;
    await expect(readClipboardText()).resolves.toBeNull();
  });

  it('places the 500-node perf fixture in one call with 500 fresh ids (EC-026 unit)', () => {
    const doc = JSON.parse(readFileSync('tests/fixtures/canvas/large-500-nodes.json', 'utf8')) as object;
    const parsed = parseClipboardText(JSON.stringify({ type: 'drawarc-clipboard', ...doc }));
    expect(parsed.kind).toBe('envelope');
    const out = placePasted((parsed as { envelope: ClipboardEnvelope }).envelope, { x: 0, y: 0 });
    expect(new Set(out.nodes.map((n) => n.id)).size).toBe(500);
  });
});
