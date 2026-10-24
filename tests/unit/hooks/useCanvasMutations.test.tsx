import { act, renderHook } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
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
