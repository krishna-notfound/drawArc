import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

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
    copy: vi.fn(() => true),
    cut: vi.fn(() => true),
    paste: vi.fn(() => true),
    pasteFromClipboard: vi.fn(() => Promise.resolve()),
    insertShape: vi.fn(),
    toggleGrid: vi.fn(),
    zoomToSelection: vi.fn(),
    resetZoom: vi.fn(),
    align: vi.fn(),
    distribute: vi.fn(),
  };
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function paste(text: string, target: EventTarget = document.body): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
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

  it('ignores keys typed into a text field or while a dialog or menu is open (AC-006, AC-007, US-8, F10 v2 Review Focus 5)', () => {
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
    press(document.body, 'c', { ctrlKey: true });
    press(document.body, 'r');
    press(document.body, 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    paste('{"type":"drawarc-clipboard"}');
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

describe('useKeyboardShortcuts (F10 v2)', () => {
  it('runs in the capture phase: a focused node that preventDefaults its own keydown neither blocks nor sees a handled shortcut (D-10g, EC-027 unit)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    document.body.innerHTML = '<div class="react-flow__node" tabindex="0" id="n"></div>';
    const nodeEl = document.getElementById('n')!;
    const nodeSaw = vi.fn((e: Event) => e.preventDefault());
    nodeEl.addEventListener('keydown', nodeSaw);
    const ev = press(nodeEl, 'c', { ctrlKey: true });
    expect(actions.copy).toHaveBeenCalledOnce();
    expect(ev.defaultPrevented).toBe(true);
    expect(nodeSaw).not.toHaveBeenCalled();
    press(nodeEl, 'k'); // unhandled keys still reach the node
    expect(nodeSaw).toHaveBeenCalledOnce();
  });

  it('Ctrl+Shift+Arrow aligns even when a focused node nudges on Arrow keys (TC-031, EC-027)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    document.body.innerHTML = '<div class="react-flow__node" tabindex="0" id="n"></div>';
    const nodeEl = document.getElementById('n')!;
    const nodeSaw = vi.fn((e: Event) => e.preventDefault());
    nodeEl.addEventListener('keydown', nodeSaw);
    const ev = press(nodeEl, 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    expect(actions.align).toHaveBeenCalledExactlyOnceWith('left');
    expect(ev.defaultPrevented).toBe(true);
    expect(nodeSaw).not.toHaveBeenCalled();
    press(nodeEl, 'ArrowLeft'); // a plain Arrow still nudges the node
    expect(nodeSaw).toHaveBeenCalledOnce();
  });

  it('letter keys insert for editors only; copy with nothing selected keeps the browser default (AC-027, FR-016)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    expect(press(document.body, 'r').defaultPrevented).toBe(true);
    expect(actions.insertShape).toHaveBeenCalledWith('rectangle');
    expect(press(document.body, 'r', { ctrlKey: true }).defaultPrevented).toBe(false);
    (actions.copy as Mock).mockReturnValue(false);
    expect(press(document.body, 'c', { ctrlKey: true }).defaultPrevented).toBe(false);
    const viewer = makeActions(false);
    renderHook(() => useKeyboardShortcuts(viewer));
    press(document.body, 'h');
    expect(viewer.insertShape).not.toHaveBeenCalled();
  });

  it('Ctrl+V is left to the paste event, which is prevented only when something was written (D-10f)', () => {
    const actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions));
    expect(press(document.body, 'v', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(paste('{"type":"drawarc-clipboard"}').defaultPrevented).toBe(true);
    expect(actions.paste).toHaveBeenCalledWith('{"type":"drawarc-clipboard"}');
    (actions.paste as Mock).mockReturnValue(false);
    expect(paste('nothing').defaultPrevented).toBe(false);
    document.body.innerHTML = '<textarea id="t"></textarea>';
    paste('x', document.getElementById('t')!);
    expect(actions.paste).toHaveBeenCalledTimes(2); // not intercepted in a text field
    const viewer = makeActions(false);
    renderHook(() => useKeyboardShortcuts(viewer));
    paste('{"type":"drawarc-clipboard"}');
    expect(viewer.paste).not.toHaveBeenCalled();
  });
});
