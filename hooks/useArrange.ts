'use client';

import { type ReactFlowState, useStore, useStoreApi } from '@xyflow/react';
import { useMemo } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { type AlignMode, alignNodes, type Axis, distributeNodes, isLocked, selectedBoxes } from '@/lib/canvas/align';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

/**
 * Align and distribute the current selection (F10 v2 FR-020/021): the geometry is pure (`lib/canvas/align.ts`), the
 * write is one `moveNodes` change set, so one undo entry; nothing is written when nothing would move. Shared by the
 * keyboard/menu actions and the selection toolbar.
 */
export function useArrange(): { align(mode: AlignMode): void; distribute(axis: Axis): void } {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const { moveNodes } = useCanvasMutations();
  return useMemo(() => {
    const apply = (moves: ReturnType<typeof alignNodes>) => {
      if (moves.length > 0) moveNodes(moves);
    };
    return {
      align: (mode) => apply(alignNodes(selectedBoxes(store.getState().nodes), mode)),
      distribute: (axis) => apply(distributeNodes(selectedBoxes(store.getState().nodes), axis)),
    };
  }, [store, moveNodes]);
}

const movableSelected = (s: ReactFlowState) =>
  s.nodes.reduce((count, node) => count + (node.selected && !isLocked(node.data) ? 1 : 0), 0);

/** How many selected nodes can move (not `data.locked`): gates the align (>= 2) and distribute (>= 3) entries. */
export function useMovableSelectedCount(): number {
  return useStore(movableSelected);
}
