import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CanvasActions } from '@/hooks/useCanvasActions';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function makeActions(canEdit = true): CanvasActions {
  return {
    canEdit,
    deleteSelection: vi.fn(),
    duplicateSelection: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    selectOnly: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    addText: vi.fn(),
    addSticky: vi.fn(),
    openCheatSheet: vi.fn(),
  };
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts (F10 FR-004–FR-006, FR-011)', () => {
  it('Delete and Backspace go to the collaborative deleteSelection and are prevented (reference bug §2)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    expect(press(document.body, 'Delete').defaultPrevented).toBe(true);
    expect(press(document.body, 'Backspace').defaultPrevented).toBe(true);
    expect(actions.deleteSelection).toHaveBeenCalledTimes(2);
    expect(press(document.body, 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(actions.undo).toHaveBeenCalledOnce();
    expect(press(document.body, 'k').defaultPrevented).toBe(false);
  });

  it('ignores keys typed into a text field or while a dialog or menu is open (AC-006, AC-007, US-8)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    document.body.innerHTML = '<textarea id="t"></textarea><div contenteditable="true" id="ce"></div>';
    const textarea = document.getElementById('t')!;
    expect(press(textarea, 'Delete').defaultPrevented).toBe(false);
    press(textarea, 'Backspace');
    press(document.getElementById('ce')!, 'z', { ctrlKey: true });

    // An open shadcn/Radix dialog owns the keyboard even when focus sits on, e.g., its close button or the body.
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog" data-state="open"><button id="close"></button></div>');
    press(document.body, 'Delete');
    press(document.getElementById('close')!, '?', { shiftKey: true });
    press(document.body, '+');
    document.body.innerHTML = '<div role="menu" data-state="open"></div>';
    press(document.body, 'Escape');

    for (const fn of Object.values(actions)) if (typeof fn === 'function') expect(fn).not.toHaveBeenCalled();
  });

  it('a read-only member gets navigation only: mutating keys are not handled at all (AC-011, EC-007)', () => {
    const actions = makeActions(false);
    renderHook(() => useKeyboardShortcuts(actions));
    for (const [k, init] of [
      ['Delete', {}],
      ['z', { ctrlKey: true }],
      ['y', { ctrlKey: true }],
      ['d', { ctrlKey: true }],
    ] as const) {
      expect(press(document.body, k, init).defaultPrevented, k).toBe(false);
    }
    expect(actions.deleteSelection).not.toHaveBeenCalled();
    expect(actions.undo).not.toHaveBeenCalled();
    expect(actions.redo).not.toHaveBeenCalled();
    expect(actions.duplicateSelection).not.toHaveBeenCalled();
    press(document.body, '=');
    press(document.body, '?', { shiftKey: true });
    expect(actions.zoomIn).toHaveBeenCalledOnce();
    expect(actions.openCheatSheet).toHaveBeenCalledOnce();
  });
});
