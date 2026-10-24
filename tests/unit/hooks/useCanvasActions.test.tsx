import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasActions } from '@/hooks/useCanvasActions';

// The React Flow store, F07's write path and Liveblocks are replaced by recorders: the subject is which writes a
// command issues, and how many.
const h = vi.hoisted(() => {
  const log: string[] = [];
  return {
    log,
    state: { nodes: [] as Record<string, unknown>[], edges: [] as Record<string, unknown>[], triggerNodeChanges: vi.fn(), triggerEdgeChanges: vi.fn() },
    mutations: {
      canEdit: true,
      onDelete: vi.fn(() => log.push('onDelete')),
      addNodes: vi.fn(() => log.push('addNodes')),
      addEdge: vi.fn(() => log.push('addEdge')),
    },
    batch: vi.fn((fn: () => void) => {
      log.push('batch:start');
      fn();
      log.push('batch:end');
    }),
  };
});

vi.mock('@xyflow/react', () => ({
  useStoreApi: () => ({ getState: () => h.state }),
  useReactFlow: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), fitView: vi.fn() }),
}));
vi.mock('@/hooks/useCanvasMutations', () => ({ useCanvasMutations: () => h.mutations }));
vi.mock('@liveblocks/react/suspense', () => ({
  useUndo: () => () => h.log.push('undo'),
  useRedo: () => () => h.log.push('redo'),
  useRoom: () => ({ batch: h.batch }),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  h.log.length = 0;
  h.mutations.canEdit = true;
});

const actions = () => renderHook(() => useCanvasActions(() => {})).result.current;

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
    expect(h.log).toEqual([]);
    expect(h.state.triggerNodeChanges).not.toHaveBeenCalled();
  });
});
