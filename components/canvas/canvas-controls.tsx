'use client';

import { useRoom } from '@liveblocks/react/suspense';
import { type LucideIcon, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, useSyncExternalStore } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CanvasActions } from '@/hooks/useCanvasActions';
import { formatKeys, type Platform, type ShortcutAction } from '@/lib/canvas/shortcuts';
import { cn } from '@/lib/utils';

interface ControlButtonProps {
  label: string;
  shortcut: ShortcutAction;
  icon: LucideIcon;
  platform: Platform;
  onClick(): void;
  disabled?: boolean;
}

function ControlButton({ label, shortcut, icon: Icon, platform, onClick, disabled = false }: ControlButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-copy-secondary outline-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-copy-secondary',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the tooltip hangs on a wrapper that does. */}
      <TooltipTrigger asChild>{disabled ? <span className="inline-flex">{button}</span> : button}</TooltipTrigger>
      <TooltipContent side="top">{`${label} (${formatKeys(shortcut, platform)})`}</TooltipContent>
    </Tooltip>
  );
}

export interface CanvasControlsProps {
  actions: Pick<CanvasActions, 'canEdit' | 'zoomIn' | 'zoomOut' | 'fitView' | 'undo' | 'redo'>;
  platform: Platform;
}

/**
 * Bottom-left control bar (FR-001, FR-003, FR-013): zoom out / fit view / zoom in, then undo / redo for members who
 * can write. Subscribes only to this client's history state, so canvas changes from other users never re-render it.
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
      <ControlButton label="Zoom out" shortcut="zoomOut" icon={Minus} platform={platform} onClick={actions.zoomOut} />
      <ControlButton label="Fit view" shortcut="fitView" icon={Maximize} platform={platform} onClick={actions.fitView} />
      <ControlButton label="Zoom in" shortcut="zoomIn" icon={Plus} platform={platform} onClick={actions.zoomIn} />
      {actions.canEdit ? <HistoryButtons actions={actions} platform={platform} /> : null}
    </div>
  );
});

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
      <ControlButton label="Undo" shortcut="undo" icon={Undo2} platform={platform} onClick={actions.undo} disabled={!canUndo} />
      <ControlButton label="Redo" shortcut="redo" icon={Redo2} platform={platform} onClick={actions.redo} disabled={!canRedo} />
    </>
  );
}
