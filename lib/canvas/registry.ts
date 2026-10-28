/**
 * F10 v2 shortcut registry (FR-014): the one place a chord is written. The keymap, the cheat-sheet rows, every
 * `<kbd>` hint and every `aria-keyshortcuts` are derived from `SHORTCUTS`; a duplicate chord throws at import
 * (so it fails every test and the build). Pure: no React, no DOM.
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
  | 'delete'
  | 'cheatSheet';

export type Platform = 'mac' | 'other';
export type ShortcutGroup = 'navigate' | 'select' | 'edit' | 'insert' | 'arrange' | 'history' | 'help';

export interface ShortcutBinding {
  action: ShortcutAction;
  /**
   * Chord grammar: `[mod+][shift+]<key>`. `<key>` is a lower-case letter, a symbol (`+`, `=`, `-`, `?` — shift is
   * never recorded for symbols), a named key (`Escape`, `Delete`, `ArrowLeft`…) or `code:<event.code>`
   * (`code:Digit1`). Alt combinations never match. `[]` for actions with no default key.
   */
  chords: readonly string[];
  /** Chords advertised through `aria-keyshortcuts` when fewer than `chords` (aliases are not advertised). */
  ariaChords?: readonly string[];
  label: string;
  group: ShortcutGroup;
  /** Not handled for read-only members. */
  mutating: boolean;
  /** Cheat-sheet row shown to viewers. */
  viewerVisible: boolean;
  /** `paste-event` chords are never matched on keydown (D-10f). */
  handledBy?: 'keydown' | 'paste-event';
}

export const SHORTCUTS: readonly ShortcutBinding[] = [
  { action: 'undo', chords: ['mod+z'], label: 'Undo', group: 'history', mutating: true, viewerVisible: false },
  {
    action: 'redo',
    chords: ['mod+shift+z', 'mod+y'],
    ariaChords: ['mod+shift+z'],
    label: 'Redo',
    group: 'history',
    mutating: true,
    viewerVisible: false,
  },
  { action: 'zoomIn', chords: ['+', '='], label: 'Zoom in', group: 'navigate', mutating: false, viewerVisible: true },
  { action: 'zoomOut', chords: ['-'], label: 'Zoom out', group: 'navigate', mutating: false, viewerVisible: true },
  { action: 'fitView', chords: ['shift+code:Digit1'], label: 'Fit view', group: 'navigate', mutating: false, viewerVisible: true },
  { action: 'clearSelection', chords: ['Escape'], label: 'Clear selection', group: 'select', mutating: false, viewerVisible: false },
  { action: 'selectAll', chords: ['mod+a'], label: 'Select all', group: 'select', mutating: false, viewerVisible: false },
  { action: 'duplicate', chords: ['mod+d'], label: 'Duplicate', group: 'edit', mutating: true, viewerVisible: false },
  { action: 'delete', chords: ['Delete', 'Backspace'], label: 'Delete', group: 'edit', mutating: true, viewerVisible: false },
  { action: 'cheatSheet', chords: ['?'], label: 'Keyboard shortcuts', group: 'help', mutating: false, viewerVisible: true },
];

/** Letters held back for later features; `matchShortcut` ignores them and the duplicate guard protects them. */
export const RESERVED_CHORDS: Readonly<Record<string, string>> = {
  t: 'F22 text',
  n: 'F22 sticky',
  f: 'F23 frame',
  x: 'F21 freehand',
  i: 'F24 image',
};

/** Actions whose binding has no default key (reachable from the bar, toolbar or menu only). */
export const KEYLESS: ReadonlySet<ShortcutAction> = new Set<ShortcutAction>(
  SHORTCUTS.filter((b) => b.chords.length === 0).map((b) => b.action),
);

/** Actions that write to Storage or history: not handled for read-only members (FR-011). */
export const MUTATING: ReadonlySet<ShortcutAction> = new Set<ShortcutAction>(
  SHORTCUTS.filter((b) => b.mutating).map((b) => b.action),
);

export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** Throws on the first chord claimed twice, across bindings and reserved letters. */
export function checkRegistry(bindings: readonly ShortcutBinding[], reserved: Readonly<Record<string, string>>): void {
  const seen = new Set<string>();
  for (const chord of [...bindings.flatMap((b) => b.chords), ...Object.keys(reserved)]) {
    if (seen.has(chord)) throw new Error(`Duplicate chord "${chord}"`);
    seen.add(chord);
  }
}

checkRegistry(SHORTCUTS, RESERVED_CHORDS);

const LETTER = /^[a-z]$/i;

/** Key form of an event (`mod+shift+z`, `r`, `+`, `Escape`); null when Alt is held. */
export function normaliseChord(e: KeyEventLike): string | null {
  if (e.altKey) return null;
  const mod = e.metaKey || e.ctrlKey ? 'mod+' : '';
  if (e.key.length === 1) {
    const letter = LETTER.test(e.key);
    return `${mod}${letter && e.shiftKey ? 'shift+' : ''}${letter ? e.key.toLowerCase() : e.key}`;
  }
  return `${mod}${e.shiftKey ? 'shift+' : ''}${e.key}`;
}

const BY_CHORD: ReadonlyMap<string, ShortcutAction> = new Map(
  SHORTCUTS.filter((b) => b.handledBy !== 'paste-event').flatMap((b) =>
    b.chords.map((c): [string, ShortcutAction] => [c, b.action]),
  ),
);

/** Looks up `[mod+][shift+]code:<e.code>` first (layout-independent chords), then the key form. */
export function matchShortcut(e: KeyEventLike): ShortcutAction | null {
  if (e.altKey) return null;
  const mods = `${e.metaKey || e.ctrlKey ? 'mod+' : ''}${e.shiftKey ? 'shift+' : ''}`;
  if (e.code) {
    const byCode = BY_CHORD.get(`${mods}code:${e.code}`);
    if (byCode) return byCode;
  }
  const chord = normaliseChord(e);
  return chord === null ? null : (BY_CHORD.get(chord) ?? null);
}

export function bindingFor(action: ShortcutAction): ShortcutBinding {
  const binding = SHORTCUTS.find((b) => b.action === action);
  if (!binding) throw new Error(`No binding for action "${action}"`);
  return binding;
}

interface ParsedChord {
  mod: boolean;
  shift: boolean;
  key: string;
}

function parseChord(chord: string): ParsedChord {
  let rest = chord;
  let mod = false;
  let shift = false;
  for (;;) {
    if (rest.startsWith('mod+') && rest.length > 4) {
      mod = true;
      rest = rest.slice(4);
    } else if (rest.startsWith('shift+') && rest.length > 6) {
      shift = true;
      rest = rest.slice(6);
    } else break;
  }
  return { mod, shift, key: rest };
}

const KEY_DISPLAY: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Delete: 'Del',
  '-': '−',
};

function displayKey(key: string): string {
  if (key.startsWith('code:')) {
    const code = key.slice(5);
    if (code === 'Quote') return "'";
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Key')) return code.slice(3);
    return code;
  }
  return KEY_DISPLAY[key] ?? (LETTER.test(key) ? key.toUpperCase() : key);
}

/** Display of the first chord (`⌘Z`, `Ctrl+Shift+Z`, `Shift+1`); '' for keyless actions. */
export function formatKeys(action: ShortcutAction, platform: Platform): string {
  const [chord] = bindingFor(action).chords;
  if (chord === undefined) return '';
  const { mod, shift, key } = parseChord(chord);
  const k = displayKey(key);
  if (platform === 'mac' && mod) return `⌘${shift ? '⇧' : ''}${k}`;
  return [mod ? 'Ctrl' : null, shift ? 'Shift' : null, k].filter(Boolean).join('+');
}

/** Platform-neutral display used by the cheat-sheet (`⌘/Ctrl+C`, `Shift+2`, `R`). '' for keyless actions. */
export function cheatSheetKeys(action: ShortcutAction): string {
  const [chord] = bindingFor(action).chords;
  if (chord === undefined) return '';
  const { mod, shift, key } = parseChord(chord);
  return `${mod ? '⌘/Ctrl+' : ''}${shift ? 'Shift+' : ''}${displayKey(key)}`;
}

function ariaKey(key: string): string {
  if (key.startsWith('code:')) return displayKey(key);
  return key === '+' ? 'Plus' : key;
}

/** W3C `aria-keyshortcuts` value; `mod` yields a `Control+` and a `Meta+` variant. '' for keyless actions. */
export function ariaKeyShortcuts(action: ShortcutAction): string {
  const b = bindingFor(action);
  return (b.ariaChords ?? b.chords)
    .flatMap((chord) => {
      const { mod, shift, key } = parseChord(chord);
      const tail = `${shift ? 'Shift+' : ''}${ariaKey(key)}`;
      return mod ? [`Control+${tail}`, `Meta+${tail}`] : [tail];
    })
    .join(' ');
}
