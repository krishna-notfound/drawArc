'use client';

import { useRedo, useRoom, useUndo } from '@liveblocks/react/suspense';
import { type EdgeChange, type NodeChange, useReactFlow, useStoreApi } from '@xyflow/react';
import { useMemo } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { duplicateSelection } from '@/lib/canvas/duplicate';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

export interface CanvasActions {
  canEdit: boolean;
  deleteSelection(): void;
  duplicateSelection(): void;
  selectAll(): void;
  clearSelection(): void;
  /** Makes exactly these nodes and edges the (local) selection. */
  selectOnly(nodeIds: readonly string[], edgeIds?: readonly string[]): void;
  zoomIn(): void;
  zoomOut(): void;
  fitView(): void;
  undo(): void;
  redo(): void;
  openCheatSheet(): void;
}

const ZOOM = { duration: 200 } as const;
const FIT = { duration: 200, padding: 0.2 } as const;

/**
 * The canvas commands shared by the control bar, the keyboard and the context menu (F10). Selection is read from
 * the React Flow store when a command runs (D-10a), never subscribed to; every write goes through F07's
 * `useCanvasMutations`. Selection itself is local: `select` changes never reach other clients.
 */
export function useCanvasActions(openCheatSheet: () => void): CanvasActions {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const rf = useReactFlow<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();
  const undo = useUndo();
  const redo = useRedo();
  const room = useRoom();

  return useMemo<CanvasActions>(() => {
    const { canEdit } = mutations;

    const selectOnly = (nodeIds: readonly string[], edgeIds: readonly string[] = []) => {
      const { nodes, edges, triggerNodeChanges, triggerEdgeChanges } = store.getState();
      const keepNodes = new Set(nodeIds);
      const keepEdges = new Set(edgeIds);
      const nodeChanges: NodeChange<CanvasNode>[] = [
        ...nodes.filter((n) => n.selected && !keepNodes.has(n.id)).map((n) => ({ type: 'select' as const, id: n.id, selected: false })),
        ...nodeIds.map((id) => ({ type: 'select' as const, id, selected: true })),
      ];
      const edgeChanges: EdgeChange<CanvasEdge>[] = [
        ...edges.filter((e) => e.selected && !keepEdges.has(e.id)).map((e) => ({ type: 'select' as const, id: e.id, selected: false })),
        ...edgeIds.map((id) => ({ type: 'select' as const, id, selected: true })),
      ];
      if (nodeChanges.length > 0) triggerNodeChanges(nodeChanges);
      if (edgeChanges.length > 0) triggerEdgeChanges(edgeChanges);
    };

    return {
      canEdit,
      selectOnly,
      deleteSelection() {
        if (!canEdit) return;
        const { nodes, edges } = store.getState();
        const selectedNodes = nodes.filter((n) => n.selected);
        const selectedEdges = edges.filter((e) => e.selected);
        if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
        // One Liveblocks mutation: the node, its attached edges (F09) and the selected edges leave in one undo step.
        mutations.onDelete({ nodes: selectedNodes, edges: selectedEdges });
      },
      duplicateSelection() {
        if (!canEdit) return;
        const { nodes, edges } = store.getState();
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;
        const copy = duplicateSelection(selectedNodes, edges);
        // One batch = one message and one undo step (D-10d).
        room.batch(() => {
          mutations.addNodes(copy.nodes);
          for (const edge of copy.edges) mutations.addEdge(edge);
        });
        selectOnly(
          copy.nodes.map((n) => n.id),
          copy.edges.map((e) => e.id),
        );
      },
      selectAll() {
        if (!canEdit) return;
        const { nodes, edges } = store.getState();
        selectOnly(
          nodes.map((n) => n.id),
          edges.map((e) => e.id),
        );
      },
      clearSelection() {
        if (!canEdit) return;
        selectOnly([], []);
      },
      zoomIn: () => void rf.zoomIn(ZOOM),
      zoomOut: () => void rf.zoomOut(ZOOM),
      fitView: () => void rf.fitView(FIT),
      undo() {
        if (canEdit) undo();
      },
      redo() {
        if (canEdit) redo();
      },
      openCheatSheet,
    };
  }, [store, rf, mutations, undo, redo, room, openCheatSheet]);
}
