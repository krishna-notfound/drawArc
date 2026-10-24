'use client';

import { type ReactFlowState, useStore } from '@xyflow/react';
import { useCallback } from 'react';

import type { CanvasNodeData, NodeColorId } from '@/types/canvas';

// `useStore` is not generic over node types; the canvas only ever holds `CanvasNode`s (F06).
type FlowState = ReactFlowState;

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const selectedIds = (s: FlowState) => s.nodes.filter((n) => n.selected).map((n) => n.id);

/**
 * Ids of the selected nodes (F08 NFR-004): a narrow store selector compared element-wise, so a consumer re-renders
 * only when the selection itself changes, not on every node move.
 */
export function useSelectedNodeIds(): string[] {
  return useStore(selectedIds, sameIds);
}

/** The colour every listed node shares, or `null` for a mixed (or empty) selection. */
export function useSelectionColor(ids: readonly string[]): NodeColorId | null {
  const select = useCallback(
    (s: FlowState): NodeColorId | null => {
      let shared: NodeColorId | null = null;
      for (const id of ids) {
        const data = s.nodeLookup.get(id)?.internals.userNode.data as CanvasNodeData | undefined;
        const color = data?.color;
        if (color === undefined || (shared !== null && color !== shared)) return null;
        shared = color;
      }
      return shared;
    },
    [ids],
  );
  return useStore(select);
}
