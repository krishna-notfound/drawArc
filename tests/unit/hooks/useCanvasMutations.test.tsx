import { act, renderHook } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { DEFAULT_SIZES, NODE_SHAPES } from '@/types/canvas';

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
