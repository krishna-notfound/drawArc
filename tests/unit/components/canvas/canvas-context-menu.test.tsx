import { describe, expect, it } from 'vitest';

import { type MenuEntry, menuEntries } from '@/components/canvas/canvas-context-menu';
import { ariaKeyShortcuts, bindingFor, formatKeys } from '@/lib/canvas/registry';

const ids = (entries: MenuEntry[]): unknown[] =>
  entries.map((e) => (e.kind === 'item' ? e.action : e.kind === 'separator' ? '|' : ['Align', ids(e.items)]));

describe('menuEntries (F10 v2 TC-038, FR-014 UX)', () => {
  it('builds the v2 menus with predicate filtering and collapsed separators (F-29)', () => {
    expect(ids(menuEntries({ kind: 'node', id: 'n' }, { canEdit: true, movableSelected: 1 }))).toEqual([
      'copy',
      'cut',
      'paste',
      'duplicate',
      '|',
      'zoomToSelection',
      '|',
      'delete',
    ]);
    expect(ids(menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 2 }))).toEqual([
      'copy',
      'cut',
      'paste',
      'duplicate',
      '|',
      ['Align', ['alignLeft', 'alignCenterH', 'alignRight', 'alignTop', 'alignMiddleV', 'alignBottom']],
      'zoomToSelection',
      '|',
      'delete',
    ]);
    expect(ids(menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 3 }))[5]).toEqual([
      'Align',
      ['alignLeft', 'alignCenterH', 'alignRight', 'alignTop', 'alignMiddleV', 'alignBottom', '|', 'distributeH', 'distributeV'],
    ]);
    expect(ids(menuEntries({ kind: 'edge', id: 'e' }, { canEdit: true, movableSelected: 0 }))).toEqual(['delete']);
    expect(ids(menuEntries({ kind: 'pane' }, { canEdit: true, movableSelected: 0 }))).toEqual([
      'paste',
      'selectAll',
      'fitView',
      'zoomToSelection',
      'cheatSheet',
    ]);
    expect(ids(menuEntries({ kind: 'pane' }, { canEdit: false, movableSelected: 0 }))).toEqual([
      'fitView',
      'zoomToSelection',
      'cheatSheet',
    ]);
  });

  it('every item resolves its label, hint and aria string from the registry', () => {
    for (const e of menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 3 })) {
      if (e.kind === 'item') expect(bindingFor(e.action).label).toBeTruthy();
    }
    expect(formatKeys('alignLeft', 'mac')).toBe('⌘⇧←');
    expect(formatKeys('alignLeft', 'other')).toBe('Ctrl+Shift+←');
    expect(formatKeys('distributeH', 'other')).toBe('');
    expect(ariaKeyShortcuts('alignLeft')).toBe('Control+Shift+ArrowLeft Meta+Shift+ArrowLeft');
  });
});
