import { renderHook } from '@testing-library/react';
import type { XYPosition } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasActions } from '@/hooks/useCanvasActions';
import { memoryClipboard } from '@/lib/canvas/clipboard';
import type { CanvasNode } from '@/types/canvas';

// The React Flow store, F07's write path and Liveblocks are replaced by recorders: the subject is which writes a
// command issues, and how many.
const h = vi.hoisted(() => {
  const log: string[] = [];
  return {
    log,
    state: {
      nodes: [] as Record<string, unknown>[],
      edges: [] as Record<string, unknown>[],
      triggerNodeChanges: vi.fn(),
      triggerEdgeChanges: vi.fn(),
      domNode: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    },
    mutations: {
      canEdit: true,
      onDelete: vi.fn(() => log.push('onDelete')),
      addNodes: vi.fn(() => log.push('addNodes')),
      addEdge: vi.fn(() => log.push('addEdge')),
      addNode: vi.fn(() => log.push('addNode')),
    },
    batch: vi.fn((fn: () => void) => {
      log.push('batch:start');
      fn();
      log.push('batch:end');
    }),
    textInserter: vi.fn(),
  };
});

vi.mock('@xyflow/react', () => ({
  useStoreApi: () => ({ getState: () => h.state }),
  useReactFlow: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    zoomTo: vi.fn(),
    screenToFlowPosition: (p: XYPosition) => ({ x: p.x * 2, y: p.y * 2 }),
  }),
}));
vi.mock('@/hooks/useCanvasMutations', () => ({ useCanvasMutations: () => h.mutations }));
vi.mock('@/lib/canvas/kinds', () => ({
  textInserter: h.textInserter,
  hasTextKind: () => false,
  textMaxLength: () => 500,
}));
vi.mock('@liveblocks/react/suspense', () => ({
  useUndo: () => () => h.log.push('undo'),
  useRedo: () => () => h.log.push('redo'),
  useRoom: () => ({ batch: h.batch }),
}));

const ULID_PAD = '01JBE00000000000000000000'; // 25 chars
const n = (id: string, selected: boolean) => ({
  id,
  type: 'canvasNode',
  position: { x: 0, y: 0 },
  width: 160,
  height: 80,
  data: { label: '', shape: 'rectangle', color: 'neutral' },
  selected,
});
const e = (id: string, source: string, target: string, selected = false) => ({ id, source, target, type: 'canvasEdge', selected });

// An envelope as Copy writes it: N1 (0,0 180×80), N2 (200,100 96×96), E1 between them, E2 to a node not in it.
const pn = (id: string, x: number, y: number, width: number, height: number, shape: string) => ({
  id,
  type: 'canvasNode',
  position: { x, y },
  width,
  height,
  data: { label: '', shape, color: 'neutral' },
});
const pe = (id: string, source: string, target: string) => ({
  id,
  type: 'canvasEdge',
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
});
const N1 = pn(`rectangle_${ULID_PAD}1`, 0, 0, 180, 80, 'rectangle');
const N2 = pn(`circle_${ULID_PAD}2`, 200, 100, 96, 96, 'circle');
const envelope = {
  type: 'drawarc-clipboard',
  schemaVersion: 1,
  nodes: [N1, N2],
  edges: [pe(`e_${ULID_PAD}3`, N1.id, N2.id), pe(`e_${ULID_PAD}4`, N1.id, `rectangle_${ULID_PAD}9`)],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.log.length = 0;
  h.mutations.canEdit = true;
  h.state.nodes = [];
  h.state.edges = [];
  h.textInserter.mockReturnValue(null);
  memoryClipboard.text = null;
});
afterEach(() => vi.unstubAllGlobals());

const actions = (pointer: XYPosition | null = { x: 400, y: 300 }) =>
  renderHook(() => useCanvasActions(() => {}, { current: pointer })).result.current;

describe('useCanvasActions (F10 FR-005, FR-007)', () => {
  it('deleteSelection hands the selected nodes and edges to onDelete once, and nothing when nothing is selected (AC-008, AC-009)', () => {
    h.state.nodes = [n('X', true), n('Y', false)];
    h.state.edges = [e('E', 'Y', 'Z', true), e('F', 'X', 'Y')];
    actions().deleteSelection();
    expect(h.mutations.onDelete).toHaveBeenCalledOnce();
    expect(h.mutations.onDelete).toHaveBeenCalledWith({ nodes: [h.state.nodes[0]], edges: [h.state.edges[0]] });

    vi.clearAllMocks();
    h.state.nodes = [n('X', false)];
    h.state.edges = [e('F', 'X', 'Y')];
    actions().deleteSelection();
    expect(h.mutations.onDelete).not.toHaveBeenCalled();
  });

  it('duplicateSelection writes nodes and internal edges in one batch, then selects only the copies (AC-014, D-10d)', () => {
    h.state.nodes = [n('X', true), n('Y', true), n('Z', false)];
    h.state.edges = [e('E', 'X', 'Y'), e('F', 'X', 'Z')];
    actions().duplicateSelection();
    expect(h.log).toEqual(['batch:start', 'addNodes', 'addEdge', 'batch:end']);
    const copies = h.mutations.addNodes.mock.calls[0] as unknown as [{ id: string }[]];
    const copyIds = copies[0].map((c) => c.id);
    expect(h.state.triggerNodeChanges).toHaveBeenCalledWith([
      { type: 'select', id: 'X', selected: false },
      { type: 'select', id: 'Y', selected: false },
      ...copyIds.map((id) => ({ type: 'select', id, selected: true })),
    ]);
  });

  it('a read-only member issues no write, no history step and no selection change (FR-011)', () => {
    h.mutations.canEdit = false;
    h.state.nodes = [n('X', true)];
    h.state.edges = [];
    const a = actions();
    a.deleteSelection();
    a.duplicateSelection();
    a.undo();
    a.redo();
    a.selectAll();
    a.cut();
    a.paste(JSON.stringify(envelope));
    a.insertShape('rectangle');
    expect(h.log).toEqual([]);
    expect(h.state.triggerNodeChanges).not.toHaveBeenCalled();
  });
});

describe('useCanvasActions clipboard and insertion (F10 v2)', () => {
  it('copy/cut serialise the selection, write memory + navigator, and cut deletes once (AC-028 unit, AC-029)', () => {
    vi.stubGlobal('navigator', {}); // EC-014
    h.state.nodes = [n('X', true), n('Y', true), n('Z', false)];
    h.state.edges = [e('E', 'X', 'Y'), e('F', 'X', 'Z')];
    expect(actions().copy()).toBe(true);
    expect(JSON.parse(memoryClipboard.text!)).toMatchObject({
      type: 'drawarc-clipboard',
      nodes: [{ id: 'X' }, { id: 'Y' }],
      edges: [{ id: 'E' }],
    });
    expect(h.log).toEqual([]);
    expect(actions().cut()).toBe(true);
    expect(h.mutations.onDelete).toHaveBeenCalledOnce();
    h.state.nodes = [n('X', false)];
    expect(actions().copy()).toBe(false);
    expect(actions().cut()).toBe(false);
  });

  it('paste places the envelope at the pointer (or the viewport centre), in one batch, then selects the copies (AC-030/032 unit, EC-019)', () => {
    const text = JSON.stringify(envelope);
    expect(actions().paste(text)).toBe(true);
    expect(h.log).toEqual(['batch:start', 'addNodes', 'addEdge', 'batch:end']);
    const [added] = h.mutations.addNodes.mock.calls[0] as unknown as [CanvasNode[]];
    expect(added[0].position).toEqual({ x: 800 - 148, y: 600 - 98 }); // screenToFlowPosition(400,300) = (800,600)
    expect(h.state.triggerNodeChanges).toHaveBeenLastCalledWith(added.map((c) => ({ type: 'select', id: c.id, selected: true })));
    vi.clearAllMocks();
    h.log.length = 0;
    actions(null).paste(text); // off-canvas → container centre (400,300) → (800,600)
    expect((h.mutations.addNodes.mock.calls[0] as unknown as [CanvasNode[]])[0][0].position).toEqual({ x: 800 - 148, y: 600 - 98 });
  });

  it('paste rejects every invalid envelope without a write, a selection change or a history entry (AC-031)', () => {
    const invalid = [
      '{"type":"other"}',
      JSON.stringify({ ...envelope, nodes: Array(501).fill(envelope.nodes[0]) }),
      JSON.stringify({ ...envelope, schemaVersion: 99 }),
      JSON.stringify({ ...envelope, nodes: [{ ...envelope.nodes[0], extra: 1 }] }),
    ];
    for (const text of invalid) expect(actions().paste(text)).toBe(false);
    expect(h.log).toEqual([]);
    expect(h.state.triggerNodeChanges).not.toHaveBeenCalled();
  });

  it('plain text becomes a text node only when the kind shim offers one (AC-033, FR-018)', () => {
    h.textInserter.mockReturnValue(null);
    expect(actions().paste('plain words')).toBe(false);
    expect(h.log).toEqual([]);
    const insert = vi.fn();
    h.textInserter.mockReturnValue(insert);
    expect(actions().paste('plain words')).toBe(true);
    expect(insert).toHaveBeenCalledWith({ x: 800, y: 600 }, { label: 'plain words' });
  });

  it('pasteFromClipboard uses readText, falls back to memory, and is a no-op when both are empty (AC-029, EC-015)', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockRejectedValue(new Error('denied')) } });
    memoryClipboard.text = JSON.stringify(envelope);
    await actions().pasteFromClipboard();
    expect(h.mutations.addNodes).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    memoryClipboard.text = null;
    await actions().pasteFromClipboard();
    expect(h.mutations.addNodes).not.toHaveBeenCalled();
  });

  it('insertShape centres the node on the pointer, or on the viewport centre without one (AC-027 hook half)', () => {
    actions().insertShape('rectangle');
    expect(h.mutations.addNode).toHaveBeenCalledWith('rectangle', { x: 800 - 90, y: 600 - 40 });
    actions(null).insertShape('circle');
    expect(h.mutations.addNode).toHaveBeenLastCalledWith('circle', { x: 800 - 48, y: 600 - 48 });
  });

  it('undo/redo are ignored mid-drag or mid-resize (FR-025, AC-041 unit)', () => {
    h.state.nodes = [{ ...n('X', true), dragging: true }];
    actions().undo();
    actions().redo();
    expect(h.log).toEqual([]);
    h.state.nodes = [{ ...n('X', true), resizing: true }];
    actions().undo();
    expect(h.log).toEqual([]);
    h.state.nodes = [n('X', true)];
    actions().undo();
    expect(h.log).toEqual(['undo']);
  });
});
