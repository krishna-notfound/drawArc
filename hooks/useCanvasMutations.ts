'use client';

import { type OnDelete, type ReactFlowState, useStore, useStoreApi, type XYPosition } from '@xyflow/react';
import { useMemo } from 'react';

import { newNodeId } from '@/lib/canvas/ids';
import { requestEditorOpen } from '@/lib/canvas/pending-editor';
import {
  type CanvasEdge,
  type CanvasEdgeData,
  type CanvasNode,
  type CanvasNodeData,
  DEFAULT_SIZES,
  type NodeDataPatch,
  type NodeShape,
} from '@/types/canvas';

/** What a text or sticky commit writes in one `replace` (F22): the label and, for text, the measured size. */
export type TextCommitPatch = { label?: string; width?: number; height?: number; autoWidth?: boolean };

export interface CanvasMutations {
  canEdit: boolean;
  /** Creates a node of `shape` at `position` (top-left, flow coordinates) and selects it; `null` when read-only. */
  addNode(shape: NodeShape, position: XYPosition): CanvasNode | null;
  /**
   * Creates a text or sticky node at `position` (top-left) and selects it; `null` when read-only. An empty text node
   * flags its editor to open on mount; a non-empty `init.label` (F10 v2 paste) skips that.
   */
  addNodeOfKind(kind: 'text' | 'sticky', position: XYPosition, init?: { label?: string }): CanvasNode | null;
  /** One `replace` carrying label, size and (text only) autoWidth: one Storage write, one undo entry. */
  commitTextNode(id: string, patch: TextCommitPatch): void;
  addNodes(items: CanvasNode[]): void;
  replaceNode(item: CanvasNode): void;
  updateNodeData(id: string, patch: NodeDataPatch): void;
  /** Merges `patch` into every listed node's data in one change set: one Liveblocks batch, one undo step (F08). */
  updateNodesData(ids: readonly string[], patch: NodeDataPatch): void;
  addEdge(item: CanvasEdge): void;
  replaceEdge(item: CanvasEdge): void;
  updateEdgeData(id: string, patch: Partial<CanvasEdgeData>): void;
  onDelete: OnDelete<CanvasNode, CanvasEdge>;
}

type FlowState = ReactFlowState<CanvasNode, CanvasEdge>;

/** A patch key set to `undefined` removes that key (an empty edge label is `data: {}`, F09 FR-007). */
function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

/**
 * `useLiveblocksFlow().onDelete` removes exactly the nodes and edges it is given, so the edges attached to a
 * deleted node are added here: node and edges then leave Storage in one batch — one undo entry (F09 FR-009).
 */
function withAttachedEdges(params: { nodes: CanvasNode[]; edges: CanvasEdge[] }, all: readonly CanvasEdge[]): CanvasEdge[] {
  if (params.nodes.length === 0) return params.edges;
  const nodeIds = new Set(params.nodes.map((n) => n.id));
  const edgeIds = new Set(params.edges.map((e) => e.id));
  const attached = all.filter((e) => !edgeIds.has(e.id) && (nodeIds.has(e.source) || nodeIds.has(e.target)));
  return attached.length === 0 ? params.edges : [...params.edges, ...attached];
}

/**
 * F06 hands `useLiveblocksFlow`'s handlers to `<ReactFlow>` only for writable members (role and token agree), and
 * React Flow keeps them in its store; so "can edit" is read from the same place the writes go.
 */
const canEditIn = (s: { nodesDraggable: boolean; onNodesChange?: unknown }) => s.nodesDraggable && s.onNodesChange != null;

/**
 * The only client write path for canvas content (F07 FR-005, data-ownership rule 1). Every change is emitted
 * through React Flow's `triggerNodeChanges` / `triggerEdgeChanges`, which call the F06 `useLiveblocksFlow`
 * handlers, so nodes and edges live only in Liveblocks Storage. Current nodes/edges are read from the store at
 * call time, never from render. Must render under F06's `ReactFlowProvider`.
 */
export function useCanvasMutations(): CanvasMutations {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const canEdit = useStore(canEditIn);

  return useMemo<CanvasMutations>(() => {
    const writable = () => canEditIn(store.getState());
    const nodeChanges: FlowState['triggerNodeChanges'] = (changes) => store.getState().triggerNodeChanges(changes);
    const edgeChanges: FlowState['triggerEdgeChanges'] = (changes) => store.getState().triggerEdgeChanges(changes);

    return {
      canEdit,
      addNode(shape, position) {
        if (!writable()) return null;
        const { width, height } = DEFAULT_SIZES[shape];
        const item: CanvasNode = {
          id: newNodeId(shape),
          type: 'canvasNode',
          position,
          width,
          height,
          data: { label: '', shape, color: 'neutral' },
        };
        nodeChanges([{ type: 'add', item }]);
        // Selection is local-only (not synced): clear the previous one, then select the new node (FR-008).
        store.getState().unselectNodesAndEdges();
        nodeChanges([{ type: 'select', id: item.id, selected: true }]);
        return item;
      },
      addNodeOfKind(kind, position, init) {
        if (!writable()) return null;
        const { width, height } = DEFAULT_SIZES[kind];
        const label = init?.label ?? '';
        const data: CanvasNodeData =
          kind === 'text'
            ? { label, shape: 'text', color: 'neutral', autoWidth: true }
            : { label, shape: 'sticky', color: 'orange' };
        const item: CanvasNode = { id: newNodeId(kind), type: 'canvasNode', position, width, height, data };
        // Flagged before the add so a synchronous mount still sees it; only the creating client ever has the flag.
        if (kind === 'text' && label === '') requestEditorOpen(item.id);
        nodeChanges([{ type: 'add', item }]);
        store.getState().unselectNodesAndEdges();
        nodeChanges([{ type: 'select', id: item.id, selected: true }]);
        return item;
      },
      commitTextNode(id, patch) {
        if (!writable()) return;
        const node = store.getState().nodeLookup.get(id)?.internals.userNode;
        if (!node) return; // deleted remotely meanwhile (EC-009)
        const { label, width, height, autoWidth } = patch;
        const data: CanvasNodeData = {
          ...node.data,
          ...(label !== undefined ? { label } : {}),
          ...(autoWidth !== undefined && node.data.shape === 'text' ? { autoWidth } : {}),
        };
        nodeChanges([
          {
            type: 'replace',
            id,
            item: { ...node, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}), data },
          },
        ]);
      },
      addNodes(items) {
        if (!writable() || items.length === 0) return;
        nodeChanges(items.map((item) => ({ type: 'add', item })));
      },
      replaceNode(item) {
        if (!writable()) return;
        nodeChanges([{ type: 'replace', id: item.id, item }]);
      },
      updateNodeData(id, patch) {
        if (!writable()) return;
        const node = store.getState().nodeLookup.get(id)?.internals.userNode;
        if (!node) return;
        nodeChanges([{ type: 'replace', id, item: { ...node, data: { ...node.data, ...patch } } }]);
      },
      updateNodesData(ids, patch) {
        if (!writable()) return;
        const { nodeLookup } = store.getState();
        const changes = ids.flatMap((id) => {
          const node = nodeLookup.get(id)?.internals.userNode;
          return node ? [{ type: 'replace' as const, id, item: { ...node, data: { ...node.data, ...patch } } }] : [];
        });
        // One `onNodesChange` call = one `useMutation` run in `useLiveblocksFlow`, which Liveblocks batches.
        if (changes.length > 0) nodeChanges(changes);
      },
      addEdge(item) {
        if (!writable()) return;
        edgeChanges([{ type: 'add', item }]);
      },
      replaceEdge(item) {
        if (!writable()) return;
        edgeChanges([{ type: 'replace', id: item.id, item }]);
      },
      updateEdgeData(id, patch) {
        if (!writable()) return;
        const edge = store.getState().edgeLookup.get(id);
        if (!edge) return;
        edgeChanges([{ type: 'replace', id, item: { ...edge, data: withoutUndefined({ ...edge.data, ...patch }) } }]);
      },
      onDelete(params) {
        if (!writable()) return;
        const { edges, onDelete } = store.getState();
        onDelete?.({ nodes: params.nodes, edges: withAttachedEdges(params, edges) });
      },
    };
  }, [store, canEdit]);
}
