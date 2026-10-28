'use client';

import { useEffect } from 'react';

import type { CanvasActions } from '@/hooks/useCanvasActions';
import { hasOpenOverlay, isEditableTarget, matchShortcut, MUTATING, type ShortcutAction } from '@/lib/canvas/shortcuts';

function run(action: ShortcutAction, actions: CanvasActions): void {
  switch (action) {
    case 'undo':
      return actions.undo();
    case 'redo':
      return actions.redo();
    case 'zoomIn':
      return actions.zoomIn();
    case 'zoomOut':
      return actions.zoomOut();
    case 'fitView':
      return actions.fitView();
    case 'clearSelection':
      return actions.clearSelection();
    case 'selectAll':
      return actions.selectAll();
    case 'duplicate':
      return actions.duplicateSelection();
    case 'delete':
      return actions.deleteSelection();
    case 'addText':
      return actions.addText();
    case 'addSticky':
      return actions.addSticky();
    case 'cheatSheet':
      return actions.openCheatSheet();
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/**
 * The canvas's single window `keydown` listener (FR-004, FR-006). Keystrokes typed into text fields, dialogs or
 * menus never reach the canvas (D-10e) — the reference editor deleted nodes while users typed. Delete goes through
 * `actions.deleteSelection` (the collaborative `onDelete`), never React Flow's `deleteKeyCode` (kept `null`, F06).
 * Mutating keys are not handled at all for read-only members, so the browser default stays theirs (EC-007).
 */
export function useKeyboardShortcuts(actions: CanvasActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (isEditableTarget(event.target) || hasOpenOverlay()) return;
      const action = matchShortcut(event);
      if (action === null) return;
      if (!actions.canEdit && MUTATING.has(action)) return;
      event.preventDefault();
      run(action, actions);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);
}
