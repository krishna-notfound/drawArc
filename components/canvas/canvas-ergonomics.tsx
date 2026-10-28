'use client';

import { type ReactNode, useCallback, useRef, useState, useSyncExternalStore } from 'react';

import { useCanvasActions } from '@/hooks/useCanvasActions';
import type { PointerRef } from '@/hooks/usePointerPosition';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { detectPlatform } from '@/lib/canvas/shortcuts';

import { CanvasContextMenu } from './canvas-context-menu';
import { CanvasControls } from './canvas-controls';
import { ShortcutCheatSheet } from './shortcut-cheat-sheet';

const noSubscribe = () => () => {};
const serverPlatform = () => 'other' as const;

/**
 * F10 around the flow: the shared canvas commands, the window keyboard handler, the right-click menu (wrapping the
 * `<ReactFlow>` element passed as children), the bottom-left control bar and the shortcut cheat-sheet. Must render
 * under F06's `ReactFlowProvider` and inside the Liveblocks room.
 */
export function CanvasErgonomics({ children, pointer }: { children: ReactNode; pointer: PointerRef }) {
  const platform = useSyncExternalStore(noSubscribe, detectPlatform, serverPlatform);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const opener = useRef<Element | null>(null);

  const openCheatSheet = useCallback(() => {
    const active = document.activeElement;
    opener.current = active?.closest('[role="menu"]') ? null : active;
    setCheatSheetOpen(true);
  }, []);
  // Opened without a Radix trigger: hand focus back to whatever had it (AC-020).
  const restoreFocus = useCallback((event: Event) => {
    const el = opener.current;
    opener.current = null;
    if (el instanceof HTMLElement && el.isConnected && el !== document.body) {
      event.preventDefault();
      el.focus({ preventScroll: true });
    }
  }, []);

  const actions = useCanvasActions(openCheatSheet, pointer);
  useKeyboardShortcuts(actions);

  return (
    <>
      <CanvasContextMenu actions={actions} platform={platform}>
        {children}
      </CanvasContextMenu>
      <CanvasControls actions={actions} platform={platform} />
      <ShortcutCheatSheet
        open={cheatSheetOpen}
        onOpenChange={setCheatSheetOpen}
        canEdit={actions.canEdit}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
