'use client';

import { useStore, useStoreApi } from '@xyflow/react';
import { type MouseEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { type CanvasActions, runAction } from '@/hooks/useCanvasActions';
import { useMovableSelectedCount } from '@/hooks/useArrange';
import { ariaKeyShortcuts, bindingFor, formatKeys, type ShortcutAction } from '@/lib/canvas/registry';
import { isEditableTarget, type Platform } from '@/lib/canvas/shortcuts';
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
const DANGER = 'text-error focus:text-error';
const HINT = 'tracking-normal text-copy-faint';
const PANEL = 'min-w-44 rounded-xl border-surface-border bg-elevated p-1 text-copy-primary shadow-xl';

export type MenuEntry =
  | { kind: 'item'; action: ShortcutAction; danger?: boolean }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: 'Align'; items: MenuEntry[] };

export interface MenuContext {
  canEdit: boolean;
  /** Selected nodes that are not `data.locked`: the Align submenu needs 2, its distribute items 3. */
  movableSelected: number;
}

const SEPARATOR: MenuEntry = { kind: 'separator' };
const item = (action: ShortcutAction, danger = false): MenuEntry => ({ kind: 'item', action, ...(danger ? { danger } : {}) });

/** Drops absent entries and separators that would lead, trail or double up. */
function collapse(entries: readonly (MenuEntry | null)[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const entry of entries) {
    if (entry === null) continue;
    if (entry.kind === 'separator' && (out.length === 0 || out[out.length - 1]!.kind === 'separator')) continue;
    out.push(entry);
  }
  while (out.length > 0 && out[out.length - 1]!.kind === 'separator') out.pop();
  return out;
}

/**
 * The v2 menu for a target (F10 v2 FR-014 UX): entries are registry actions, so label, hint and `aria-keyshortcuts`
 * are never written here; predicates omit items that cannot apply and the separators around them collapse.
 */
export function menuEntries(target: ContextTarget, ctx: MenuContext): MenuEntry[] {
  if (target.kind === 'edge') return [item('delete', true)];
  if (target.kind === 'pane') {
    return collapse([
      ctx.canEdit ? item('paste') : null,
      ctx.canEdit ? item('selectAll') : null,
      item('fitView'),
      item('zoomToSelection'),
      item('cheatSheet'),
    ]);
  }
  const align: MenuEntry | null =
    ctx.movableSelected >= 2
      ? {
          kind: 'submenu',
          label: 'Align',
          items: collapse([
            item('alignLeft'),
            item('alignCenterH'),
            item('alignRight'),
            item('alignTop'),
            item('alignMiddleV'),
            item('alignBottom'),
            ctx.movableSelected >= 3 ? SEPARATOR : null,
            ctx.movableSelected >= 3 ? item('distributeH') : null,
            ctx.movableSelected >= 3 ? item('distributeV') : null,
          ]),
        }
      : null;
  return collapse([
    item('copy'),
    item('cut'),
    item('paste'),
    item('duplicate'),
    SEPARATOR,
    align,
    item('zoomToSelection'),
    SEPARATOR,
    item('delete', true),
  ]);
}

function renderEntries(entries: readonly MenuEntry[], actions: CanvasActions, platform: Platform): ReactNode {
  return entries.map((entry, index) => {
    if (entry.kind === 'separator') return <ContextMenuSeparator key={`sep-${index}`} />;
    if (entry.kind === 'submenu') {
      return (
        <ContextMenuSub key={entry.label}>
          <ContextMenuSubTrigger className={ITEM}>{entry.label}</ContextMenuSubTrigger>
          <ContextMenuSubContent className={PANEL}>{renderEntries(entry.items, actions, platform)}</ContextMenuSubContent>
        </ContextMenuSub>
      );
    }
    const hint = formatKeys(entry.action, platform);
    return (
      <ContextMenuItem
        key={entry.action}
        className={entry.danger ? `${ITEM} ${DANGER}` : ITEM}
        aria-keyshortcuts={ariaKeyShortcuts(entry.action) || undefined}
        onSelect={() => void runAction(entry.action, actions)}
      >
        {bindingFor(entry.action).label}
        {hint ? <ContextMenuShortcut className={HINT}>{hint}</ContextMenuShortcut> : null}
      </ContextMenuItem>
    );
  });
}

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
  const movableSelected = useMovableSelectedCount();

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
        className={PANEL}
      >
        {renderEntries(menuEntries(target, { canEdit: actions.canEdit, movableSelected }), actions, platform)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
