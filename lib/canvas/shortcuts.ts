/**
 * F10 keyboard model: which keys map to which canvas action, which targets swallow them, and how each shortcut is
 * written in the UI (tooltips, menu hints, cheat-sheet). Pure: no React, no DOM beyond reading event targets.
 */

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'fitView'
  | 'clearSelection'
  | 'selectAll'
  | 'duplicate'
  | 'addText'
  | 'addSticky'
  | 'delete'
  | 'cheatSheet';

export type Platform = 'mac' | 'other';

/** Actions that write to Storage or history: no-ops (and not `preventDefault`ed) for read-only members (FR-011). */
export const MUTATING: ReadonlySet<ShortcutAction> = new Set<ShortcutAction>([
  'undo',
  'redo',
  'duplicate',
  'delete',
  'addText',
  'addSticky',
]);

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/**
 * Maps a keydown to a canvas action (FR-006). `mod` is ⌘ or Ctrl on every platform (both accepted, so a Mac user
 * on a PC keyboard is not locked out). Modifier-less keys never match with ⌘/Ctrl/Alt held, so ⌘/Ctrl+- browser
 * zoom keeps working (D-10e).
 */
export function matchShortcut(e: KeyEventLike): ShortcutAction | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const mod = e.metaKey || e.ctrlKey;
  const shift = e.shiftKey;
  if (e.altKey) return null;
  if (mod) {
    if (key === 'z') return shift ? 'redo' : 'undo';
    if (key === 'y' && !shift) return 'redo';
    if (key === 'a' && !shift) return 'selectAll';
    if (key === 'd' && !shift) return 'duplicate';
    return null;
  }
  if (shift && e.code === 'Digit1') return 'fitView';
  if (!shift && key === 't') return 'addText';
  if (!shift && key === 'n') return 'addSticky';
  switch (key) {
    case '+':
    case '=':
      return 'zoomIn';
    case '-':
      return 'zoomOut';
    case 'Escape':
      return 'clearSelection';
    case 'Delete':
    case 'Backspace':
      return 'delete';
    case '?':
      return 'cheatSheet';
    default:
      return null;
  }
}

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

/** How a shortcut is written in tooltips, menu hints and the cheat-sheet. */
export function formatKeys(action: ShortcutAction, platform: Platform): string {
  const mac = platform === 'mac';
  switch (action) {
    case 'undo':
      return mac ? '⌘Z' : 'Ctrl+Z';
    case 'redo':
      return mac ? '⌘⇧Z' : 'Ctrl+Shift+Z';
    case 'selectAll':
      return mac ? '⌘A' : 'Ctrl+A';
    case 'duplicate':
      return mac ? '⌘D' : 'Ctrl+D';
    case 'addText':
      return 'T';
    case 'addSticky':
      return 'N';
    case 'zoomIn':
      return '+';
    case 'zoomOut':
      return '−';
    case 'fitView':
      return 'Shift+1';
    case 'clearSelection':
      return 'Esc';
    case 'delete':
      return 'Del';
    case 'cheatSheet':
      return '?';
  }
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
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
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
  { action: 'Select all', input: '⌘/Ctrl+A', viewerVisible: false },
  { action: 'Duplicate', input: '⌘/Ctrl+D', viewerVisible: false },
  { action: 'Add text', input: '`T` — type; Enter commits, Esc removes an empty text', viewerVisible: false },
  { action: 'Add sticky note', input: '`N`', viewerVisible: false },
  { action: 'Clear selection', input: 'Esc', viewerVisible: false },
  { action: 'Keyboard shortcuts', input: '?', viewerVisible: true },
];
