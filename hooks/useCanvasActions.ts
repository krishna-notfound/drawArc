'use client';

import { useRedo, useRoom, useUndo } from '@liveblocks/react/suspense';
import { type EdgeChange, type NodeChange, useReactFlow, useStoreApi, type XYPosition } from '@xyflow/react';
import { useMemo } from 'react';

import { useArrange } from '@/hooks/useArrange';
import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import type { PointerRef } from '@/hooks/usePointerPosition';
import {
  CLIPBOARD_MAX_CHARS,
  CLIPBOARD_MAX_EDGES,
  CLIPBOARD_MAX_NODES,
  parseClipboardText,
  placePasted,
  readClipboardText,
  serializeSelection,
  writeClipboardText,
} from '@/lib/canvas/clipboard';
import type { AlignMode, Axis } from '@/lib/canvas/align';
import { centredDropPosition } from '@/lib/canvas/drop-position';
import { duplicateSelection } from '@/lib/canvas/duplicate';
import { focusNodeWhenRendered } from '@/lib/canvas/focus-node';
import { textInserter, textMaxLength } from '@/lib/canvas/kinds';
import { gridStore } from '@/lib/canvas/preferences';
import type { ShortcutAction } from '@/lib/canvas/registry';
import { type CanvasEdge, type CanvasNode, DEFAULT_SIZES, type NodeShape } from '@/types/canvas';

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
  /** False (and nothing written) with no node selected, so the key keeps its browser default. */
  copy(): boolean;
  /** `copy()` then one delete (same as Delete): one undo entry. */
  cut(): boolean;
  /** Synchronous: parse, place at the pointer or viewport centre, one batch, select the copies. Whether anything was written. */
  paste(text: string): boolean;
  /** Menu path: clipboard text (permission permitting, else the in-memory copy) into `paste`. */
  pasteFromClipboard(): Promise<void>;
  /** Adds `shape` centred on the pointer, or on the viewport centre when the pointer is off the canvas. */
  insertShape(shape: NodeShape): void;
  /** Adds an empty text node centred on the pointer (or viewport centre) and opens it for typing (F22). */
  addText(): void;
  /** Adds a sticky note centred on the pointer (or viewport centre) and focuses it (F22). */
  addSticky(): void;
  /** Flips this user's grid preference (localStorage only); allowed for viewers, never a history entry. */
  toggleGrid(): void;
  /** Fits the selected nodes (padding 0.2, 200 ms), or everything when nothing is selected. */
  zoomToSelection(): void;
  /** Zoom to 100 % (the control bar readout). */
  resetZoom(): void;
  /** Aligns the selected, unlocked nodes (needs >= 2); one undo entry, nothing written when nothing moves. */
  align(mode: AlignMode): void;
  /** Spreads the selected, unlocked nodes with equal gaps (needs >= 3); one undo entry. */
  distribute(axis: Axis): void;
}

const ZOOM = { duration: 200 } as const;
const FIT = { duration: 200, padding: 0.2 } as const;

const INSERT_SHAPE: Partial<Record<ShortcutAction, NodeShape>> = {
  insertRectangle: 'rectangle',
  insertDiamond: 'diamond',
  insertCircle: 'circle',
  insertPill: 'pill',
  insertCylinder: 'cylinder',
  insertHexagon: 'hexagon',
};

/**
 * Runs a registry action. The switch has no `default`, so a new `ShortcutAction` fails the build until it is wired
 * here. Returns whether the action was handled: `false` leaves the browser default alone (copy with nothing
 * selected); menu `Paste` goes through `pasteFromClipboard` because the keyboard path is the `paste` event.
 */
export function runAction(action: ShortcutAction, actions: CanvasActions): boolean {
  switch (action) {
    case 'undo':
      actions.undo();
      return true;
    case 'redo':
      actions.redo();
      return true;
    case 'zoomIn':
      actions.zoomIn();
      return true;
    case 'zoomOut':
      actions.zoomOut();
      return true;
    case 'fitView':
      actions.fitView();
      return true;
    case 'clearSelection':
      actions.clearSelection();
      return true;
    case 'selectAll':
      actions.selectAll();
      return true;
    case 'duplicate':
      actions.duplicateSelection();
      return true;
    case 'delete':
      actions.deleteSelection();
      return true;
    case 'cheatSheet':
      actions.openCheatSheet();
      return true;
    case 'copy':
      return actions.copy();
    case 'cut':
      return actions.cut();
    case 'paste':
      void actions.pasteFromClipboard();
      return true;
    case 'insertRectangle':
    case 'insertDiamond':
    case 'insertCircle':
    case 'insertPill':
    case 'insertCylinder':
    case 'insertHexagon': {
      const shape = INSERT_SHAPE[action];
      if (!shape) return false;
      actions.insertShape(shape);
      return true;
    }
    case 'toggleGrid':
      actions.toggleGrid();
      return true;
    case 'zoomToSelection':
      actions.zoomToSelection();
      return true;
    case 'resetZoom':
      actions.resetZoom();
      return true;
    case 'alignLeft':
      actions.align('left');
      return true;
    case 'alignRight':
      actions.align('right');
      return true;
    case 'alignTop':
      actions.align('top');
      return true;
    case 'alignBottom':
      actions.align('bottom');
      return true;
    case 'alignCenterH':
      actions.align('centerH');
      return true;
    case 'alignMiddleV':
      actions.align('middleV');
      return true;
    case 'distributeH':
      actions.distribute('h');
      return true;
    case 'distributeV':
      actions.distribute('v');
      return true;
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/**
 * The canvas commands shared by the control bar, the keyboard and the context menu (F10). Selection is read from
 * the React Flow store when a command runs (D-10a), never subscribed to; every write goes through F07's
 * `useCanvasMutations`. Selection itself is local: `select` changes never reach other clients.
 */
export function useCanvasActions(openCheatSheet: () => void, pointer: PointerRef): CanvasActions {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const rf = useReactFlow<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();
  const undo = useUndo();
  const redo = useRedo();
  const room = useRoom();
  const arrange = useArrange();

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

    /** The flow-space point commands act on: the pointer over the canvas, else the centre of the viewport. */
    const targetPoint = (): XYPosition => {
      const client = pointer.current;
      if (client) return rf.screenToFlowPosition(client);
      const rect = store.getState().domNode?.getBoundingClientRect();
      return rf.screenToFlowPosition(
        rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      );
    };

    /** T / N insertion: centred on the pointer, else the viewport centre. */
    const addAtPoint = (kind: 'text' | 'sticky') => {
      if (!canEdit) return;
      const node = mutations.addNodeOfKind(kind, centredDropPosition(targetPoint(), DEFAULT_SIZES[kind]));
      // A text node focuses its own textarea; a sticky takes keyboard focus like a shape does (F07 FR-008).
      const domNode = store.getState().domNode;
      if (node && kind === 'sticky' && domNode) focusNodeWhenRendered(domNode, node.id);
    };

    const deleteSelection = () => {
      if (!canEdit) return;
      const { nodes, edges } = store.getState();
      const selectedNodes = nodes.filter((n) => n.selected);
      const selectedEdges = edges.filter((e) => e.selected);
      if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
      // One Liveblocks mutation: the node, its attached edges (F09) and the selected edges leave in one undo step.
      mutations.onDelete({ nodes: selectedNodes, edges: selectedEdges });
    };

    const copy = (): boolean => {
      const { nodes, edges } = store.getState();
      const envelope = serializeSelection(nodes, edges);
      if (envelope.nodes.length === 0) return false;
      if (envelope.nodes.length > CLIPBOARD_MAX_NODES || envelope.edges.length > CLIPBOARD_MAX_EDGES) return false;
      const text = JSON.stringify(envelope);
      if (text.length > CLIPBOARD_MAX_CHARS) return false;
      void writeClipboardText(text);
      return true;
    };

    const paste = (text: string): boolean => {
      if (!canEdit) return false;
      const parsed = parseClipboardText(text);
      if (parsed.kind === 'none') return false;
      const at = targetPoint();
      if (parsed.kind === 'text') {
        const insert = textInserter(mutations);
        const label = parsed.text.trim().slice(0, textMaxLength());
        if (!insert || label === '') return false;
        insert(at, { label });
        return true;
      }
      const placed = placePasted(parsed.envelope, at);
      if (placed.nodes.length === 0) return false;
      // One batch = one message and one undo step.
      room.batch(() => {
        mutations.addNodes(placed.nodes);
        for (const edge of placed.edges) mutations.addEdge(edge);
      });
      selectOnly(
        placed.nodes.map((n) => n.id),
        placed.edges.map((e) => e.id),
      );
      return true;
    };

    /** Content and positions only: never mid-drag or mid-resize, when the history holds a half-moved node (FR-025). */
    const interacting = () => store.getState().nodes.some((n) => n.dragging || n.resizing);

    return {
      canEdit,
      selectOnly,
      deleteSelection,
      duplicateSelection() {
        if (!canEdit) return;
        const { nodes, edges } = store.getState();
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;
        const copyOf = duplicateSelection(selectedNodes, edges);
        // One batch = one message and one undo step (D-10d).
        room.batch(() => {
          mutations.addNodes(copyOf.nodes);
          for (const edge of copyOf.edges) mutations.addEdge(edge);
        });
        selectOnly(
          copyOf.nodes.map((n) => n.id),
          copyOf.edges.map((e) => e.id),
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
        if (canEdit && !interacting()) undo();
      },
      redo() {
        if (canEdit && !interacting()) redo();
      },
      openCheatSheet,
      copy,
      cut() {
        if (!canEdit) return false;
        if (!copy()) return false;
        deleteSelection();
        return true;
      },
      paste,
      async pasteFromClipboard() {
        const text = await readClipboardText();
        if (text) paste(text);
      },
      insertShape(shape) {
        if (!canEdit) return;
        mutations.addNode(shape, centredDropPosition(targetPoint(), DEFAULT_SIZES[shape]));
      },
      addText: () => addAtPoint('text'),
      addSticky: () => addAtPoint('sticky'),
      toggleGrid: () => gridStore.set(!gridStore.get()),
      zoomToSelection() {
        const selected = store.getState().nodes.filter((n) => n.selected);
        if (selected.length === 0) void rf.fitView(FIT);
        else void rf.fitView({ ...FIT, nodes: selected.map((n) => ({ id: n.id })) });
      },
      resetZoom: () => void rf.zoomTo(1, ZOOM),
      align(mode) {
        if (canEdit) arrange.align(mode);
      },
      distribute(axis) {
        if (canEdit) arrange.distribute(axis);
      },
    };
  }, [store, rf, mutations, undo, redo, room, arrange, openCheatSheet, pointer]);
}
