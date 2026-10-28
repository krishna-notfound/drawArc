import { act, renderHook } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { takeEditorOpen } from '@/lib/canvas/pending-editor';
import { type CanvasEdge, type CanvasNode, DEFAULT_SIZES, NODE_SHAPES } from '@/types/canvas';

// F06 passes useLiveblocksFlow's handlers to <ReactFlow> only for writable members; React Flow keeps them in its
// store, which is what the mutations hook writes through.
function setup(writable: boolean) {
  const onNodesChange = vi.fn();
  const { result } = renderHook(() => ({ mutations: useCanvasMutations(), store: useStoreApi() }), {
    wrapper: ReactFlowProvider,
  });
  act(() => {
    result.current.store.setState(writable ? { onNodesChange, nodesDraggable: true } : { nodesDraggable: false });
  });
  return { result, onNodesChange };
}

const ULID = '[0-9A-HJKMNP-TV-Z]{26}';

describe('useCanvasMutations().addNode (F07 AC-009, AC-005, AC-020 unit half)', () => {
  it('emits exactly one add change with the schema-v1 node, then selects it', () => {
    const { result, onNodesChange } = setup(true);
    expect(result.current.mutations.canEdit).toBe(true);

    const node = result.current.mutations.addNode('circle', { x: 10, y: 20 });

    expect(node).toEqual({
      id: expect.stringMatching(new RegExp(`^circle_${ULID}$`)),
      type: 'canvasNode',
      position: { x: 10, y: 20 },
      width: 96,
      height: 96,
      data: { label: '', shape: 'circle', color: 'neutral' },
    });
    expect(Object.keys(node!).sort()).toEqual(['data', 'height', 'id', 'position', 'type', 'width']);
    expect(onNodesChange.mock.calls).toEqual([
      [[{ type: 'add', item: node }]],
      [[{ type: 'select', id: node!.id, selected: true }]],
    ]);
  });

  it('sizes every shape from DEFAULT_SIZES', () => {
    const { result } = setup(true);
    for (const shape of NODE_SHAPES) {
      const node = result.current.mutations.addNode(shape, { x: 0, y: 0 })!;
      expect({ width: node.width, height: node.height }).toEqual(DEFAULT_SIZES[shape]);
    }
  });

  it('is a silent no-op for read-only members', () => {
    const { result, onNodesChange } = setup(false);
    expect(result.current.mutations.canEdit).toBe(false);
    expect(result.current.mutations.addNode('circle', { x: 0, y: 0 })).toBeNull();
    expect(onNodesChange).not.toHaveBeenCalled();
  });
});

describe('useCanvasMutations edges (F09 FR-007, FR-009)', () => {
  const edge = (id: string, source: string, target: string, data: { label?: string } = {}) =>
    ({ id, source, target, sourceHandle: 'right', targetHandle: 'left', type: 'canvasEdge', data }) as CanvasEdge;
  const X = { id: 'x', position: { x: 0, y: 0 }, data: {} } as unknown as CanvasNode;

  function setupEdges(edges: CanvasEdge[]) {
    const onDelete = vi.fn();
    const onEdgesChange = vi.fn();
    const { result } = renderHook(() => ({ mutations: useCanvasMutations(), store: useStoreApi() }), {
      wrapper: ReactFlowProvider,
    });
    act(() => {
      result.current.store.setState({
        onNodesChange: vi.fn(),
        nodesDraggable: true,
        onDelete,
        onEdgesChange,
        edges,
        edgeLookup: new Map(edges.map((e) => [e.id, e])),
      } as never);
    });
    return { mutations: result.current.mutations, onDelete, onEdgesChange };
  }

  it('deleting a node also deletes every edge attached to it, in one onDelete call (AC-015 unit half)', () => {
    const into = edge('e_in', 'a', 'x');
    const out = edge('e_out', 'x', 'b');
    const unrelated = edge('e_u', 'a', 'b');
    const { mutations, onDelete } = setupEdges([into, out, unrelated]);
    mutations.onDelete({ nodes: [X], edges: [out] });
    expect(onDelete).toHaveBeenCalledExactlyOnceWith({ nodes: [X], edges: [out, into] });
  });

  it('an empty label commit removes the key instead of storing undefined', () => {
    const { mutations, onEdgesChange } = setupEdges([edge('e_1', 'a', 'b', { label: 'HTTPS' })]);
    mutations.updateEdgeData('e_1', { label: undefined });
    const [[changes]] = onEdgesChange.mock.calls;
    expect(changes).toEqual([{ type: 'replace', id: 'e_1', item: edge('e_1', 'a', 'b', {}) }]);
    expect(Object.keys(changes[0].item.data)).toEqual([]);
  });
});

describe('useCanvasMutations().updateNodesData (F08 AC-017 unit half)', () => {
  it('recolours every listed node in one onNodesChange call (one Liveblocks batch, one undo step)', () => {
    const { result, onNodesChange } = setup(true);
    const shapes = ['rectangle', 'circle', 'pill'] as const;
    const ids = shapes.map((shape) => result.current.mutations.addNode(shape, { x: 0, y: 0 })!.id);
    // addNode only emits changes; feed the nodes into the (uncontrolled) store as Liveblocks would.
    act(() => {
      result.current.store.getState().setNodes(
        onNodesChange.mock.calls.flatMap(([changes]) => changes).filter((c) => c.type === 'add').map((c) => c.item),
      );
    });
    onNodesChange.mockClear();

    result.current.mutations.updateNodesData([...ids, 'missing'], { color: 'green' });

    expect(onNodesChange).toHaveBeenCalledTimes(1);
    const [changes] = onNodesChange.mock.calls[0]!;
    expect(changes.map((c: { type: string; id: string }) => [c.type, c.id])).toEqual(ids.map((id) => ['replace', id]));
    for (const change of changes) expect(change.item.data.color).toBe('green');
  });
});

describe('useCanvasMutations().addNodeOfKind / commitTextNode (F22 AC-007, AC-010, AC-018 unit half)', () => {
  it('addNodeOfKind creates a text node 24x20 with autoWidth and flags its editor to open', () => {
    const { result, onNodesChange } = setup(true);
    const node = result.current.mutations.addNodeOfKind('text', { x: 5, y: 6 })!;
    expect(node).toMatchObject({ width: 24, height: 20, data: { label: '', shape: 'text', color: 'neutral', autoWidth: true } });
    expect(node.id).toMatch(/^text_/);
    expect(takeEditorOpen(node.id)).toBe(true);
    expect(takeEditorOpen(node.id)).toBe(false);
    expect(onNodesChange.mock.calls[0]).toEqual([[{ type: 'add', item: node }]]);
    expect(onNodesChange.mock.calls[1]).toEqual([[{ type: 'select', id: node.id, selected: true }]]);
  });

  it('addNodeOfKind creates a 250x250 orange sticky; an initial label skips the editor flag', () => {
    const { result } = setup(true);
    const sticky = result.current.mutations.addNodeOfKind('sticky', { x: 0, y: 0 })!;
    expect(sticky).toMatchObject({ width: 250, height: 250, data: { label: '', shape: 'sticky', color: 'orange' } });
    expect(sticky.id).toMatch(/^sticky_/);
    expect(takeEditorOpen(sticky.id)).toBe(false);
    const pasted = result.current.mutations.addNodeOfKind('text', { x: 0, y: 0 }, { label: 'pasted' })!;
    expect(pasted.data.label).toBe('pasted');
    expect(takeEditorOpen(pasted.id)).toBe(false);
  });

  it('commitTextNode writes label, width, height and autoWidth in one replace', () => {
    const { result, onNodesChange } = setup(true);
    const node = result.current.mutations.addNodeOfKind('text', { x: 0, y: 0 })!;
    act(() => {
      result.current.store.getState().setNodes([node]);
    });
    onNodesChange.mockClear();

    result.current.mutations.commitTextNode(node.id, { label: 'Hi', width: 120, height: 24, autoWidth: false });

    expect(onNodesChange).toHaveBeenCalledTimes(1);
    expect(onNodesChange.mock.calls[0][0]).toEqual([
      {
        type: 'replace',
        id: node.id,
        item: expect.objectContaining({
          width: 120,
          height: 24,
          data: { label: 'Hi', shape: 'text', color: 'neutral', autoWidth: false },
        }),
      },
    ]);
  });

  it('addNodeOfKind and commitTextNode are silent no-ops for read-only members', () => {
    const { result, onNodesChange } = setup(false);
    expect(result.current.mutations.addNodeOfKind('text', { x: 0, y: 0 })).toBeNull();
    result.current.mutations.commitTextNode('text_x', { label: 'x' });
    expect(onNodesChange).not.toHaveBeenCalled();
  });
});

describe('useCanvasMutations().moveNodes (F10 v2 FR-020)', () => {
  const n = (id: string, x: number, y: number) =>
    ({ id, type: 'canvasNode', position: { x, y }, width: 100, height: 50, data: { label: '', shape: 'rectangle', color: 'neutral' } }) as CanvasNode;

  it('emits one replace change set with new positions and skips unknown ids', () => {
    const { result, onNodesChange } = setup(true);
    const nodes = [n('A', 0, 0), n('B', 300, 200)];
    act(() =>
      result.current.store.setState({
        nodes,
        nodeLookup: new Map(nodes.map((node) => [node.id, { internals: { userNode: node } }])),
      } as never),
    );
    result.current.mutations.moveNodes([
      { id: 'A', position: { x: 250, y: 0 } },
      { id: 'ghost', position: { x: 1, y: 1 } },
    ]);
    expect(onNodesChange).toHaveBeenCalledOnce();
    expect(onNodesChange.mock.calls[0][0]).toEqual([
      { type: 'replace', id: 'A', item: expect.objectContaining({ id: 'A', position: { x: 250, y: 0 } }) },
    ]);
    result.current.mutations.moveNodes([]);
    expect(onNodesChange).toHaveBeenCalledOnce();
  });
});
