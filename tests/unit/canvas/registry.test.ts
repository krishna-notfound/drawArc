import { describe, expect, it } from 'vitest';

import {
  ariaKeyShortcuts,
  bindingFor,
  checkRegistry,
  cheatSheetKeys,
  formatKeys,
  KEYLESS,
  matchShortcut,
  RESERVED_CHORDS,
  SHORTCUTS,
  type ShortcutAction,
} from '@/lib/canvas/registry';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}, code = '') => ({
  key: k,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('registry (F10 AC-025)', () => {
  it('has no duplicate chord across SHORTCUTS and RESERVED_CHORDS, and every keyed action has a chord', () => {
    const all = [...SHORTCUTS.flatMap((b) => b.chords), ...Object.keys(RESERVED_CHORDS)];
    expect(new Set(all).size).toBe(all.length);
    for (const b of SHORTCUTS) expect(b.chords.length > 0 || KEYLESS.has(b.action), b.action).toBe(true);
    expect(() => checkRegistry(SHORTCUTS, RESERVED_CHORDS)).not.toThrow();
    expect(() => checkRegistry([...SHORTCUTS, { ...bindingFor('copy'), chords: ['mod+a'] }], RESERVED_CHORDS)).toThrow(/Duplicate chord "mod\+a"/);
    expect(() => checkRegistry(SHORTCUTS, { ...RESERVED_CHORDS, d: 'x' })).toThrow(/"d"/);
  });

  it('keeps the ten v1 labels verbatim and renders W3C aria strings', () => {
    const v1: [ShortcutAction, string, string][] = [
      ['undo', '⌘Z', 'Ctrl+Z'],
      ['redo', '⌘⇧Z', 'Ctrl+Shift+Z'],
      ['selectAll', '⌘A', 'Ctrl+A'],
      ['duplicate', '⌘D', 'Ctrl+D'],
      ['zoomIn', '+', '+'],
      ['zoomOut', '−', '−'],
      ['fitView', 'Shift+1', 'Shift+1'],
      ['clearSelection', 'Esc', 'Esc'],
      ['delete', 'Del', 'Del'],
      ['cheatSheet', '?', '?'],
    ];
    for (const [action, mac, other] of v1) {
      expect(formatKeys(action, 'mac')).toBe(mac);
      expect(formatKeys(action, 'other')).toBe(other);
    }
    expect(ariaKeyShortcuts('redo')).toBe('Control+Shift+z Meta+Shift+z');
    expect(ariaKeyShortcuts('zoomIn')).toBe('Plus =');
    expect(ariaKeyShortcuts('fitView')).toBe('Shift+1');
    expect(cheatSheetKeys('redo')).toBe('⌘/Ctrl+Shift+Z');
  });

  it('matchShortcut: code chords, symbols ignore shift, reserved letters are inert (AC-027 pure)', () => {
    expect(matchShortcut(key('!', { shiftKey: true }, 'Digit1'))).toBe('fitView');
    expect(matchShortcut(key('+', { shiftKey: true }))).toBe('zoomIn');
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    for (const k of ['t', 'n', 'f', 'x', 'i', 'k']) expect(matchShortcut(key(k)), k).toBeNull();
    expect(matchShortcut(key('r', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key('h', { altKey: true }))).toBeNull();
    expect(matchShortcut(key('R', { shiftKey: true }))).toBeNull();
  });

  it('grid and zoom-to-selection chords are layout-independent code chords; reset zoom has no key (AC-034, AC-039)', () => {
    expect(matchShortcut(key("'", { ctrlKey: true }, 'Quote'))).toBe('toggleGrid');
    expect(matchShortcut(key('@', { shiftKey: true }, 'Digit2'))).toBe('zoomToSelection');
    expect(formatKeys('toggleGrid', 'other')).toBe("Ctrl+'");
    expect(formatKeys('toggleGrid', 'mac')).toBe("⌘'");
    expect(formatKeys('zoomToSelection', 'mac')).toBe('Shift+2');
    expect(ariaKeyShortcuts('toggleGrid')).toBe("Control+' Meta+'");
    expect(formatKeys('resetZoom', 'other')).toBe('');
    expect(ariaKeyShortcuts('resetZoom')).toBe('');
  });

  it('align chords are Ctrl/Cmd+Shift+Arrow; centre, middle and distribute have no key (AC-037)', () => {
    expect(matchShortcut(key('ArrowLeft', { ctrlKey: true, shiftKey: true }))).toBe('alignLeft');
    expect(matchShortcut(key('ArrowDown', { metaKey: true, shiftKey: true }))).toBe('alignBottom');
    expect(matchShortcut(key('ArrowLeft', { shiftKey: true }))).toBeNull();
    expect(matchShortcut(key('ArrowLeft', { ctrlKey: true }))).toBeNull();
    expect(formatKeys('alignLeft', 'mac')).toBe('⌘⇧←');
    expect(formatKeys('alignLeft', 'other')).toBe('Ctrl+Shift+←');
    expect(ariaKeyShortcuts('alignLeft')).toBe('Control+Shift+ArrowLeft Meta+Shift+ArrowLeft');
    for (const a of ['alignCenterH', 'alignMiddleV', 'distributeH', 'distributeV'] as const) expect(formatKeys(a, 'other')).toBe('');
  });

  it('letters insert shapes (CapsLock-safe), Ctrl+V is left to the paste event (AC-027)', () => {
    const letters: [string, ShortcutAction][] = [
      ['r', 'insertRectangle'],
      ['d', 'insertDiamond'],
      ['o', 'insertCircle'],
      ['p', 'insertPill'],
      ['c', 'insertCylinder'],
      ['h', 'insertHexagon'],
    ];
    for (const [k, a] of letters) expect(matchShortcut(key(k))).toBe(a);
    expect(matchShortcut(key('R'))).toBe('insertRectangle');
    expect(matchShortcut(key('c', { ctrlKey: true }))).toBe('copy');
    expect(matchShortcut(key('x', { metaKey: true }))).toBe('cut');
    expect(matchShortcut(key('v', { ctrlKey: true }))).toBeNull();
    expect(formatKeys('paste', 'other')).toBe('Ctrl+V');
  });
});
