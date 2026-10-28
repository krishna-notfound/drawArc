'use client';

import { useRoom } from '@liveblocks/react/suspense';
import { useStore } from '@xyflow/react';
import { Grid3x3, type LucideIcon, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, useSyncExternalStore } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CanvasActions } from '@/hooks/useCanvasActions';
import { useGrid } from '@/hooks/useGrid';
import { ariaKeyShortcuts, bindingFor, formatKeys, type Platform, type ShortcutAction } from '@/lib/canvas/registry';
import { cn } from '@/lib/utils';

interface ControlButtonProps {
  shortcut: ShortcutAction;
  icon: LucideIcon;
  platform: Platform;
  onClick(): void;
  disabled?: boolean;
  pressed?: boolean;
}

/** Label, hint and `aria-keyshortcuts` all come from the registry (FR-014): no chord is written here. */
function ControlButton({ shortcut, icon: Icon, platform, onClick, disabled = false, pressed }: ControlButtonProps) {
  const { label } = bindingFor(shortcut);
  const hint = formatKeys(shortcut, platform);
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={ariaKeyShortcuts(shortcut) || undefined}
      aria-pressed={pressed}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-copy-secondary outline-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-copy-secondary',
        pressed && 'bg-subtle text-copy-primary',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the tooltip hangs on a wrapper that does. */}
      <TooltipTrigger asChild>{disabled ? <span className="inline-flex">{button}</span> : button}</TooltipTrigger>
      <TooltipContent side="top">{hint ? `${label} (${hint})` : label}</TooltipContent>
    </Tooltip>
  );
}

export interface CanvasControlsProps {
  actions: Pick<CanvasActions, 'canEdit' | 'zoomIn' | 'zoomOut' | 'fitView' | 'undo' | 'redo' | 'toggleGrid' | 'resetZoom'>;
  platform: Platform;
}

/**
 * Bottom-left control bar (FR-001, FR-003, FR-013, F10 v2 FR-023/FR-024): zoom out, the zoom readout, zoom in, fit
 * view and the grid toggle, then undo / redo for members who can write. Subscribes only to this client's history state, so canvas changes from other users never re-render it.
 */
export const CanvasControls = memo(function CanvasControls({ actions, platform }: CanvasControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas controls"
      aria-orientation="horizontal"
      data-slot="canvas-controls"
      className="fixed bottom-20 left-4 z-10 flex items-center gap-0.5 rounded-xl border border-surface-border bg-surface/95 p-1 shadow-lg md:bottom-4"
    >
      <ZoomButtons actions={actions} platform={platform} />
      <GridButton actions={actions} platform={platform} />
      {actions.canEdit ? <HistoryButtons actions={actions} platform={platform} /> : null}
    </div>
  );
});

const zoomPercent = (s: { transform: [number, number, number] }) => Math.round(s.transform[2] * 100);
const atMaxZoom = (s: { transform: [number, number, number]; maxZoom: number }) => s.transform[2] >= s.maxZoom - 1e-6;
const atMinZoom = (s: { transform: [number, number, number]; minZoom: number }) => s.transform[2] <= s.minZoom + 1e-6;

/** Zoom out · readout (click resets to 100 %) · zoom in · fit view; the limit buttons disable at 0.1 and 4. */
function ZoomButtons({ actions, platform }: CanvasControlsProps) {
  const percent = useStore(zoomPercent);
  const maxed = useStore(atMaxZoom);
  const minned = useStore(atMinZoom);
  return (
    <>
      <ControlButton shortcut="zoomOut" icon={Minus} platform={platform} onClick={actions.zoomOut} disabled={minned} />
      <button
        type="button"
        data-slot="zoom-readout"
        aria-label={`Zoom ${percent} %, reset to 100 %`}
        onClick={actions.resetZoom}
        className="h-8 min-w-14 rounded-lg px-1 text-center text-xs tabular-nums text-copy-secondary outline-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
      >
        {percent} %
      </button>
      <ControlButton shortcut="zoomIn" icon={Plus} platform={platform} onClick={actions.zoomIn} disabled={maxed} />
      <ControlButton shortcut="fitView" icon={Maximize} platform={platform} onClick={actions.fitView} />
    </>
  );
}

function GridButton({ actions, platform }: CanvasControlsProps) {
  const grid = useGrid();
  return <ControlButton shortcut="toggleGrid" icon={Grid3x3} platform={platform} onClick={actions.toggleGrid} pressed={grid} />;
}

/**
 * This client's `canUndo`/`canRedo` (Liveblocks history is per client, D-013). Like `useCanUndo`/`useCanRedo`, but
 * the snapshot is re-read after the change completes: Liveblocks emits its history event while a new change is
 * pushed and only then drops the redo stack (silently), so the stock hooks kept Redo enabled after a new change
 * (AC-022).
 */
function useHistoryFlags(): { canUndo: boolean; canRedo: boolean } {
  const room = useRoom();
  const subscribe = useCallback(
    (onChange: () => void) => room.events.history.subscribe(() => queueMicrotask(onChange)),
    [room],
  );
  const canUndo = useSyncExternalStore(subscribe, room.history.canUndo, room.history.canUndo);
  const canRedo = useSyncExternalStore(subscribe, room.history.canRedo, room.history.canRedo);
  return { canUndo, canRedo };
}

function HistoryButtons({ actions, platform }: CanvasControlsProps) {
  const { canUndo, canRedo } = useHistoryFlags();
  return (
    <>
      <div role="separator" aria-orientation="vertical" className="mx-0.5 h-5 w-px bg-surface-border" />
      <ControlButton shortcut="undo" icon={Undo2} platform={platform} onClick={actions.undo} disabled={!canUndo} />
      <ControlButton shortcut="redo" icon={Redo2} platform={platform} onClick={actions.redo} disabled={!canRedo} />
    </>
  );
}
