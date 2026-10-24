'use client';

import { useStore, useStoreApi } from '@xyflow/react';
import { type MouseEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { CanvasActions } from '@/hooks/useCanvasActions';
import { formatKeys, isEditableTarget, type Platform } from '@/lib/canvas/shortcuts';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

export type ContextTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'selection' }
  | { kind: 'pane' };

/** A right-button press that travelled further than this was a pan, not a click (EC-006). */
const PAN_DISTANCE = 4;

/**
 * What a right-click landed on, read from React Flow's DOM. Text fields keep the browser's own menu; anything
 * that is not part of the flow (toolbars rendered inside `<ReactFlow>`) gets no canvas menu.
 */
export function resolveContextTarget(el: Element): ContextTarget | null {
  if (isEditableTarget(el)) return null;
  const nodeId = el.closest('.react-flow__node')?.getAttribute('data-id');
  if (nodeId) return { kind: 'node', id: nodeId };
  const edgeId =
    el.closest('.react-flow__edge')?.getAttribute('data-id') ?? el.closest('[data-edge-label]')?.getAttribute('data-edge-label');
  if (edgeId) return { kind: 'edge', id: edgeId };
  if (el.closest('.react-flow__nodesselection')) return { kind: 'selection' };
  if (el.closest('.react-flow__pane')) return { kind: 'pane' };
  return null;
}

const ITEM = 'rounded-lg text-copy-primary focus:bg-subtle focus:text-copy-primary';
const HINT = 'tracking-normal text-copy-faint';

export interface CanvasContextMenuProps {
  actions: CanvasActions;
  platform: Platform;
  children: ReactNode;
}

/**
 * Right-click menu for nodes, edges and the pane (FR-009, D-10b). Radix positions it at the pointer, flips it at
 * the viewport edges and makes it keyboard operable; the target is resolved from the DOM in the capture phase.
 * React Flow's own pane swallows `contextmenu` while right-drag pans (`panOnDrag` includes 2: it calls
 * `preventDefault`, so neither `onPaneContextMenu` nor Radix would ever see it), so a pane right-click is re-issued
 * on the trigger itself. A right-press that moved more than 4 px was a pan and opens nothing.
 */
export function CanvasContextMenu({ actions, platform, children }: CanvasContextMenuProps) {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const wrapper = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const reissuing = useRef(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ContextTarget>({ kind: 'pane' });

  // EC-013: the element the menu was opened on disappeared (deleted remotely) — close the menu.
  const targetGone = useStore((s) =>
    target.kind === 'node' ? !s.nodeLookup.has(target.id) : target.kind === 'edge' ? !s.edgeLookup.has(target.id) : false,
  );
  if (open && targetGone) setOpen(false);

  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    pressedAt.current = e.button === 2 ? { x: e.clientX, y: e.clientY } : null;
  };

  const onContextMenuCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (reissuing.current) return;
    const pressed = pressedAt.current;
    pressedAt.current = null;
    const swallow = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > PAN_DISTANCE) return swallow();
    const resolved = e.target instanceof Element ? resolveContextTarget(e.target) : null;
    if (resolved === null) {
      e.stopPropagation(); // not ours: the browser's menu, never a canvas menu with a stale target
      return;
    }
    // Read-only members cannot select (F06), so every right-click is a pane right-click for them (FR-011).
    const next: ContextTarget = actions.canEdit ? resolved : { kind: 'pane' };
    const { nodeLookup, edgeLookup } = store.getState();
    if (next.kind === 'node' && !nodeLookup.get(next.id)?.selected) actions.selectOnly([next.id]);
    if (next.kind === 'edge' && !edgeLookup.get(next.id)?.selected) actions.selectOnly([], [next.id]);
    setTarget(next);
    if (next.kind !== 'pane') return; // Radix's trigger handler opens the menu
    swallow();
    reissuing.current = true;
    try {
      wrapper.current?.dispatchEvent(
        new window.MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
        }),
      );
    } finally {
      reissuing.current = false;
    }
  };

  const hint = (text: string) => <ContextMenuShortcut className={HINT}>{text}</ContextMenuShortcut>;

  return (
    <ContextMenu open={open} onOpenChange={setOpen}>
      <ContextMenuTrigger asChild>
        <div
          ref={wrapper}
          data-slot="canvas-context-menu-trigger"
          className="h-full w-full"
          onPointerDownCapture={onPointerDownCapture}
          onContextMenuCapture={onContextMenuCapture}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        collisionPadding={8}
        aria-label="Canvas actions"
        className="min-w-44 rounded-xl border-surface-border bg-elevated p-1 text-copy-primary shadow-xl"
      >
        {target.kind === 'node' || target.kind === 'selection' ? (
          <>
            <ContextMenuItem className={ITEM} onSelect={actions.duplicateSelection}>
              Duplicate{hint(formatKeys('duplicate', platform))}
            </ContextMenuItem>
            <ContextMenuItem className={`${ITEM} text-error focus:text-error`} onSelect={actions.deleteSelection}>
              Delete{hint(formatKeys('delete', platform))}
            </ContextMenuItem>
          </>
        ) : target.kind === 'edge' ? (
          <ContextMenuItem className={`${ITEM} text-error focus:text-error`} onSelect={actions.deleteSelection}>
            Delete{hint(formatKeys('delete', platform))}
          </ContextMenuItem>
        ) : (
          <>
            {actions.canEdit ? (
              <ContextMenuItem className={ITEM} onSelect={actions.selectAll}>
                Select all{hint(formatKeys('selectAll', platform))}
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem className={ITEM} onSelect={actions.fitView}>
              Fit view{hint(formatKeys('fitView', platform))}
            </ContextMenuItem>
            <ContextMenuItem className={ITEM} onSelect={actions.openCheatSheet}>
              Keyboard shortcuts{hint(formatKeys('cheatSheet', platform))}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
