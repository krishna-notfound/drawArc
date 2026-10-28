'use client';

import { useEffect } from 'react';

import { type CanvasActions, runAction } from '@/hooks/useCanvasActions';
import { hasOpenOverlay, isEditableTarget, matchShortcut, MUTATING } from '@/lib/canvas/shortcuts';

/**
 * The canvas's single window `keydown` listener (FR-004, FR-006) plus its `paste` listener. Keystrokes typed into
 * text fields, dialogs or menus never reach the canvas (D-10e) — the reference editor deleted nodes while users
 * typed. Delete goes through `actions.deleteSelection` (the collaborative `onDelete`), never React Flow's
 * `deleteKeyCode` (kept `null`, F06). Mutating keys are not handled at all for read-only members, so the browser
 * default stays theirs (EC-007).
 *
 * The keydown listener runs in the capture phase (D-10g): a focused node's own handler nudges on Arrow keys and
 * calls `preventDefault` without looking at Ctrl/Meta (`@xyflow/react` 12.12.0 `index.js` L2312–2325), which would
 * swallow `Ctrl+Shift+Arrow` before a bubbling listener saw it. `Ctrl+V` is never matched on keydown: the `paste`
 * event carries the text without a clipboard permission and lets us decide `preventDefault` synchronously (D-10f).
 */
export function useKeyboardShortcuts(actions: CanvasActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (isEditableTarget(event.target) || hasOpenOverlay()) return;
      const action = matchShortcut(event);
      if (action === null) return;
      if (!actions.canEdit && MUTATING.has(action)) return;
      if (!runAction(action, actions)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target) || hasOpenOverlay()) return;
      if (!actions.canEdit) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (actions.paste(text)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('paste', onPaste);
    };
  }, [actions]);
}
