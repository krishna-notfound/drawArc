import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isEditableTarget, matchShortcut, SHORTCUT_ROWS } from '@/lib/canvas/shortcuts';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}, code = '') => ({
  key: k,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('matchShortcut (F10 AC-010)', () => {
  it('maps every documented shortcut, accepting ⌘ and Ctrl alike', () => {
    expect(matchShortcut(key('z', { ctrlKey: true }))).toBe('undo');
    expect(matchShortcut(key('z', { metaKey: true }))).toBe('undo');
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(matchShortcut(key('y', { ctrlKey: true }))).toBe('redo');
    expect(matchShortcut(key('+', { shiftKey: true }))).toBe('zoomIn');
    expect(matchShortcut(key('='))).toBe('zoomIn');
    expect(matchShortcut(key('-'))).toBe('zoomOut');
    expect(matchShortcut(key('!', { shiftKey: true }, 'Digit1'))).toBe('fitView');
    expect(matchShortcut(key('Escape'))).toBe('clearSelection');
    expect(matchShortcut(key('a', { ctrlKey: true }))).toBe('selectAll');
    expect(matchShortcut(key('d', { metaKey: true }))).toBe('duplicate');
    expect(matchShortcut(key('Delete'))).toBe('delete');
    expect(matchShortcut(key('Backspace'))).toBe('delete');
    expect(matchShortcut(key('?', { shiftKey: true }, 'Slash'))).toBe('cheatSheet');
  });

  it('leaves browser zoom (⌘/Ctrl +/-), Alt combos and unknown keys alone', () => {
    expect(matchShortcut(key('-', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key('=', { metaKey: true }))).toBeNull();
    expect(matchShortcut(key('=', { altKey: true }))).toBeNull();
    expect(matchShortcut(key('Delete', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key('k'))).toBeNull();
    expect(matchShortcut(key('1', {}, 'Digit1'))).toBeNull();
  });
});

describe('isEditableTarget (F10 AC-006, D-10e)', () => {
  it('claims keystrokes in text fields, contenteditable and dialogs, not on the canvas', () => {
    document.body.innerHTML = `
      <input id="i"><textarea id="t"></textarea><select id="s"></select>
      <div contenteditable="" id="ce1"></div><div contenteditable="true" id="ce2"></div>
      <div role="dialog"><span id="in-dialog"></span></div>
      <div class="react-flow__pane" id="pane"></div><button id="b"></button><div id="d"></div>`;
    const byId = (id: string) => document.getElementById(id);
    for (const id of ['i', 't', 's', 'ce1', 'ce2', 'in-dialog']) expect(isEditableTarget(byId(id)), id).toBe(true);
    for (const id of ['pane', 'b', 'd']) expect(isEditableTarget(byId(id)), id).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

/** The rows of the "Interaction conventions" table in context/ui-context.md, the copy's source of truth. */
function conventionRows(): { action: string; input: string }[] {
  const md = readFileSync('context/ui-context.md', 'utf8');
  const section = md.slice(md.indexOf('## Interaction conventions'));
  const lines = section.split('\n').filter((line) => line.startsWith('|'));
  return lines.slice(2).map((line) => {
    const [action, input] = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return { action, input };
  });
}

describe('cheat-sheet copy (F10 AC-019)', () => {
  it('reproduces the ui-context interaction table verbatim, then the F10 rows', () => {
    const rows = conventionRows();
    expect(rows).toHaveLength(10);
    expect(SHORTCUT_ROWS.slice(0, 10).map(({ action, input }) => ({ action, input }))).toEqual(rows);
    expect(SHORTCUT_ROWS.slice(10).map((r) => r.action)).toEqual([
      'Select all',
      'Duplicate',
      'Clear selection',
      'Keyboard shortcuts',
      'Copy / Cut / Paste',
      'Add shape at pointer',
      'Grid',
      'Zoom to selection',
    ]);
    expect(SHORTCUT_ROWS.filter((r) => r.viewerVisible).map((r) => r.action)).toEqual([
      'Pan',
      'Zoom',
      'Fit view',
      'Keyboard shortcuts',
      'Grid',
      'Zoom to selection',
    ]);
  });
});
