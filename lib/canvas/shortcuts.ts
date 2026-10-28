/**
 * F10 keyboard model: which targets swallow shortcuts, and the cheat-sheet rows. The keymap and every key label
 * come from the registry (`lib/canvas/registry.ts`, F10 v2 FR-014); the v1 exports are re-exported from there.
 * Pure: no React, no DOM beyond reading event targets.
 */
import { cheatSheetKeys, type Platform, type ShortcutAction } from '@/lib/canvas/registry';

export { formatKeys, matchShortcut, MUTATING } from '@/lib/canvas/registry';
export type { Platform, ShortcutAction } from '@/lib/canvas/registry';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"]';
const OPEN_OVERLAY =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]';

/** True when a keystroke belongs to a text field or an overlay, not to the canvas (D-10e). */
export function isEditableTarget(t: EventTarget | null): boolean {
  return t instanceof Element && t.closest(EDITABLE) !== null;
}

/** An open shadcn/Radix dialog or menu owns the keyboard, wherever focus happens to be (EC-001). */
export function hasOpenOverlay(doc: Document = document): boolean {
  return doc.querySelector(OPEN_OVERLAY) !== null;
}

/** Best-effort platform sniff for labels only (key matching accepts both modifiers). */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const name = nav.userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ipod/i.test(name) ? 'mac' : 'other';
}

export interface ShortcutRow {
  action: string;
  /** Markdown-flavoured: backtick spans render as keys. */
  input: string;
  viewerVisible: boolean;
}

/**
 * Cheat-sheet rows (FR-010). The first ten are copied verbatim from `context/ui-context.md` "Interaction
 * conventions" — a unit test compares them, so an edit there fails until this table follows.
 */
const TEN_VERBATIM_ROWS: readonly ShortcutRow[] = [
  { action: 'Pan', input: 'scroll / middle-drag / right-drag / Space+drag', viewerVisible: true },
  { action: 'Zoom', input: '⌘/Ctrl+scroll, pinch, `+`/`=`/`-`, control bar', viewerVisible: true },
  { action: 'Fit view', input: 'control bar, `Shift+1`', viewerVisible: true },
  { action: 'Box select', input: 'drag on empty canvas (partial overlap selects)', viewerVisible: false },
  { action: 'Add to selection', input: 'Shift+click (box) · ⌘/Ctrl+click (toggle)', viewerVisible: false },
  {
    action: 'Add node',
    input: 'drag from palette; ghost preview follows cursor; drop centres node under cursor',
    viewerVisible: false,
  },
  {
    action: 'Edit label',
    input: 'double-click node/edge; Enter commits (Shift+Enter newline in nodes); Esc cancels; blur commits',
    viewerVisible: false,
  },
  { action: 'Delete', input: 'Delete / Backspace (not while editing text)', viewerVisible: false },
  { action: 'Undo / redo', input: '⌘/Ctrl+Z · ⌘/Ctrl+Shift+Z · ⌘/Ctrl+Y', viewerVisible: false },
  {
    action: 'Context menu',
    input:
      'right-click node/edge/pane → duplicate, delete (feature 10; no z-order commands — `zIndex` is not synced by `@liveblocks/react-flow`)',
    viewerVisible: false,
  },
];

const REGISTRY_TABLE: readonly { action: string; actions: ShortcutAction[]; viewerVisible: boolean }[] = [
  { action: 'Select all', actions: ['selectAll'], viewerVisible: false },
  { action: 'Duplicate', actions: ['duplicate'], viewerVisible: false },
  { action: 'Clear selection', actions: ['clearSelection'], viewerVisible: false },
  { action: 'Keyboard shortcuts', actions: ['cheatSheet'], viewerVisible: true },
  { action: 'Copy / Cut / Paste', actions: ['copy', 'cut', 'paste'], viewerVisible: false },
  {
    action: 'Add shape at pointer',
    actions: ['insertRectangle', 'insertDiamond', 'insertCircle', 'insertPill', 'insertCylinder', 'insertHexagon'],
    viewerVisible: false,
  },
  { action: 'Grid', actions: ['toggleGrid'], viewerVisible: true },
  { action: 'Zoom to selection', actions: ['zoomToSelection'], viewerVisible: true },
];

/** Rows after the ten verbatim ones are written from the registry, so no chord is typed twice (FR-014). */
const REGISTRY_ROWS: readonly ShortcutRow[] = REGISTRY_TABLE.map(({ action, actions, viewerVisible }) => ({
  action,
  input: actions.map((a) => '`' + cheatSheetKeys(a) + '`').join(' · '),
  viewerVisible,
}));

export const SHORTCUT_ROWS: readonly ShortcutRow[] = [...TEN_VERBATIM_ROWS, ...REGISTRY_ROWS];
