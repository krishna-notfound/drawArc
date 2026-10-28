# F10 v2 Canvas Productivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clipboard copy/cut/paste, letter-key shape insertion, a per-user 20 px grid, align/distribute, a zoom readout with `Shift+2`, and a single shortcut registry to the shipped F10 v1 canvas, with the undo set written down and tested.

**Architecture:** Client-only, under the existing `ReactFlowProvider` + `RoomProvider`; nothing new crosses a server boundary. One registry (`lib/canvas/registry.ts`) is the only place a chord is written; `lib/canvas/shortcuts.ts` keeps every v1 export re-implemented over it. New pure modules (`clipboard.ts`, `align.ts`, `preferences.ts`, `kinds.ts`) are unit-tested; `useCanvasActions` grows and stays the single command surface for keyboard, bar, menu and toolbar; every write still goes through `useCanvasMutations`. F22 is never imported directly: `lib/canvas/kinds.ts` reads `NODE_KINDS` / `addNodeOfKind` / `TEXT_MAX_LENGTH` through widened types and falls back to `NODE_SHAPES`, so this branch builds and passes on `main` with or without F22.

**Tech Stack:** Next.js 16 (Cache Components), React 19, TypeScript strict, `@xyflow/react` 12.12.0, `@liveblocks/react` 3.24.4, Zod 4, shadcn `context-menu` (incl. `ContextMenuSub*`), `lucide-react`, Vitest + Testing Library (jsdom), Playwright (Chromium, `E2E_PORT`).

**Spec:** `features/10-canvas-ergonomics-and-keyboard/` — the "## v2 — canvas productivity (2026-10-28)" sections of all seven files (FR-014–FR-025, EC-014–EC-027, AC-025–AC-043, T-009–T-015, TC-029–TC-047), approved by D-066 with `docs/research/batch1-owner-decisions.md` decisions 1–3 adopted as recommended. v1 is shipped (PR #15) and is not re-planned. Read `02-design.md` §v2 for contracts and `03-acceptance-criteria.md` §v2 for the exact assertions; this plan cites them as `AC-0NN`.

## Global Constraints

- **Branch:** `feat/f10-v2-canvas-productivity` off `main` (`52d587e`), own worktree; built in parallel with F22 — never import a name that only F22 exports (`NODE_KINDS`, `addNodeOfKind`, `TEXT_MAX_LENGTH`, `data.locked`) except through `lib/canvas/kinds.ts` or an optional-field read (`data.locked === true`).
- **Single registry (FR-014):** `SHORTCUTS` + `RESERVED_CHORDS` in `lib/canvas/registry.ts` drive `matchShortcut`, `formatKeys`, `ariaKeyShortcuts`, the cheat-sheet rows after the ten verbatim ui-context rows, every control/menu/toolbar `<kbd>` hint and every `aria-keyshortcuts`. No component or test hard-codes a chord string for display. A unit test fails on any duplicate normalised chord (across bindings and `RESERVED_CHORDS`). `RESERVED_CHORDS = { t: 'F22 text', n: 'F22 sticky', f: 'F23 frame', x: 'F21 freehand', i: 'F24 image' }`.
- **Letter insertion (FR-015):** `r d o p c h` (no modifier, case-insensitive, CapsLock-safe) → rectangle / diamond / circle / pill / cylinder / hexagon through `useCanvasMutations.addNode`, centred on the last pointer position over the canvas (`screenToFlowPosition` + `centredDropPosition`) else on the viewport centre; `Ctrl+R`, `Alt+H`, `Shift+R`, `t`, `n` → no match. Viewers: nothing called, nothing prevented.
- **Clipboard (FR-016/017, D-10f):** envelope `{ type: 'drawarc-clipboard', schemaVersion, nodes, edges }` written as `text/plain` via `navigator.clipboard.writeText` and always kept in memory; keyboard paste from the window `paste` event (`Ctrl+V` is listed in the registry, `handledBy: 'paste-event'`, never matched on keydown); menu paste via `readText()` with memory fallback. Caps `CLIPBOARD_MAX_CHARS = 1_000_000`, `CLIPBOARD_MAX_NODES = 500`, `CLIPBOARD_MAX_EDGES = 1_000`; strict Zod; older `schemaVersion` through `migrate`; newer rejected. Paste re-ids with `${kind}_${ulid}` (`newNodeId(shape)`) and `e_${ulid}`, remaps endpoints, drops dangling edges, keeps relative layout (bbox centre → pointer / viewport centre), one `room.batch`, selects exactly the pasted items; viewers cannot paste, cut, insert, align or distribute.
- **Plain text (FR-018, D-10j):** creates a text node only when `lib/canvas/kinds.ts` reports a `'text'` kind, via `addNodeOfKind('text', pointer, { label })`, label trimmed to 500; otherwise nothing is written and the browser default is left alone.
- **Grid (FR-019, D-10i):** `Ctrl+'` (`code === 'Quote'`) and a "Grid" toggle (`aria-pressed`) → `snapToGrid` + `snapGrid={[20, 20]}` + `<Background variant="lines" gap={20}>`; off → v1 dots. Persisted only in `localStorage['drawarc.grid']` (`'1'`/absent), never in Storage, no undo entry, available to viewers; snap on drag only (inserted/pasted nodes are not rounded).
- **Align/distribute (FR-020/021, D-10k):** on stored `width`/`height`; `Ctrl+Shift+Arrow` aligns left/right/top/bottom; centre/middle and distribute have no default key; ≥ 2 movable (align) / ≥ 3 (distribute); `data.locked === true` excluded from move set and bounding box; one `replace` change set = one undo entry; nothing written when nothing moves.
- **Zoom (FR-023/024, D-10h):** readout `${Math.round(zoom*100)} %` between Zoom out and Zoom in, `aria-label="Zoom N %, reset to 100 %"`, click → `zoomTo(1, { duration: 200 })`; Zoom in disabled at `maxZoom` 4, Zoom out at `minZoom` 0.1; `Shift+2` → `fitView({ nodes: selected, duration: 200, padding: 0.2 })`, nothing selected → fit all. `fitView` is still called only from `hooks/useCanvasActions.ts` (F06 FR-009 allowlist).
- **Keyboard (D-10g):** the window `keydown` listener runs in the capture phase; v1 ignore rules (`defaultPrevented`, `isComposing`, editable target, open overlay) run first; every handled shortcut calls `preventDefault()` and `stopPropagation()`. Verified in `@xyflow/react` 12.12.0 `dist/esm/index.js` L2312–2325: the node wrapper nudges on Arrow keys with `preventDefault` and no Ctrl/Meta check.
- **Undo set (FR-025):** content and positions only; selection, viewport, grid and cheat-sheet state never create or consume an entry; `Ctrl+Z`/`Ctrl+Y` are no-ops while `nodes.some(n => n.dragging || n.resizing)`; AC-042 (remote change does not clear redo) is UNVERIFIED for Liveblocks — the e2e asserts it, and a failure is recorded in `status.md` as observed behaviour, never patched around.
- **Unchanged v1 decisions:** Esc clears selection (D-053), `Ctrl+D` offset +20/+20 (D-054), partial box select (D-055), `ui-context.md` rows verbatim (AC-019), platform labels (`⌘Z` / `Ctrl+Z`).
- **Control bar order:** Zoom out · readout · Zoom in · Fit view · Grid · separator · Undo · Redo (viewers: first five). **Context menu:** node/selection → Copy, Cut, Paste, Duplicate, Align ▸, Zoom to selection, Delete; edge → Delete; pane → Paste, Select all, Fit view, Zoom to selection, Keyboard shortcuts; failed predicates omit the item and adjacent separators collapse.
- **Project rules:** `CLAUDE.md` §4/§5/§7; `context/code-standards.md` (no React in `lib/`, no `process.env` outside `lib/env*.ts`, `useStore` narrow selectors, no `useState` mirror of nodes/edges, do not edit `components/ui/*`); `context/testing-strategy.md` "Test budget": only behaviour/risk tests, one unit file per pure module, the two existing hook test files extended, one single-user and one two-user e2e spec.
- **Commits:** exactly five, grouped by requirement (registry → clipboard+keyboard → grid+zoom → align/distribute → e2e), each passing `npm run check`; author and committer `krishna <krishnagtkr@gmail.com>`, **no AI attribution or `Co-Authored-By` trailer of any kind**; conventional messages; no push. If the worktree's index holds unrelated owner changes, commit through a temporary index (`GIT_INDEX_FILE` + `git read-tree HEAD` + add pathspecs) so it is never altered.
- **E2E:** `npm run e2e` with `E2E_PORT` set per worktree (`playwright.config.ts` L9); new specs follow the repo's flat `tests/e2e/<name>.spec.ts` convention (the spec's `tests/e2e/canvas/10-*.spec.ts` paths do not exist in this repo — see Spec gaps).

## Review Focus

1. **Paste when the clipboard permission is denied or `navigator.clipboard` is absent.** Expected: keyboard paste still works (the `paste` event carries the text without permission); menu Paste falls back to the in-memory envelope; with both empty it is a silent no-op. Pinned by `readClipboardText` cases in Task 2 and `pasteFromClipboard` cases in Task 3.
2. **Paste into a different project (or a stale tab) whose ids collide or whose edges reference nodes that are not in the envelope.** Expected: every node and edge gets a fresh id, dangling edges are dropped, and the same envelope pasted twice yields disjoint ids. Pinned by `placePasted` cases in Task 2 and the second-tab paste in Task 6.
3. **Align with one node, with all nodes already aligned, or where locked nodes leave fewer than 2/3 movable.** Expected: no write, no undo entry, toolbar/menu entries absent. Pinned by the `alignNodes`/`distributeNodes` degenerate cases and the `useArrange` "no write" case in Task 5.
4. **Grid toggle persistence across reload and when `localStorage` throws.** Expected: the flag survives a reload in the same browser profile; in private mode it defaults off and still toggles for the session; toggling never enables Undo. Pinned by `gridStore` cases in Task 4 and the reload step of the grid e2e in Task 6.
5. **A shortcut pressed while the cheat-sheet dialog or a context menu is open, or while a node's label editor has focus.** Expected: the capture-phase listener still yields to the overlay/editor (no copy, no insertion, no align), because the v1 ignore rules run before matching. Pinned by the extended "ignores keys in overlays" case in Task 3 (adds `c`, `r`, `Control+Shift+ArrowLeft` and a `paste` event to the v1 list).

---

### Task 1: Shortcut registry (spec T-009) — commit 1

**Files:**
- Create: `lib/canvas/registry.ts`
- Modify: `lib/canvas/shortcuts.ts` (whole file: keep every v1 export, re-implement over the registry)
- Create: `tests/unit/canvas/registry.test.ts`
- Modify: `tests/unit/canvas/shortcuts.test.ts` (v1 cases unchanged; `matchShortcut` is now imported from `@/lib/canvas/registry` via the `shortcuts.ts` re-export — no edit needed unless the import path is changed; leave it)

**Interfaces:**
- Consumes: nothing new.
- Produces (every later task and F22 hook into these):

```ts
// lib/canvas/registry.ts
export type ShortcutAction = 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'fitView' | 'clearSelection' | 'selectAll' | 'duplicate' | 'delete' | 'cheatSheet';
// Task 3 appends: | 'copy' | 'cut' | 'paste' | 'insertRectangle' | 'insertDiamond' | 'insertCircle' | 'insertPill' | 'insertCylinder' | 'insertHexagon'
// Task 4 appends: | 'toggleGrid' | 'zoomToSelection' | 'resetZoom'
// Task 5 appends: | 'alignLeft' | 'alignRight' | 'alignTop' | 'alignBottom' | 'alignCenterH' | 'alignMiddleV' | 'distributeH' | 'distributeV'
export type Platform = 'mac' | 'other';
export type ShortcutGroup = 'navigate' | 'select' | 'edit' | 'insert' | 'arrange' | 'history' | 'help';
export interface ShortcutBinding {
  action: ShortcutAction;
  /** Chord grammar: `[mod+][shift+]<key>`. `<key>` is a lower-case letter, a symbol (`+`, `=`, `-`, `?` — shift never recorded for symbols), a named key (`Escape`, `Delete`, `Backspace`, `ArrowLeft`…), or `code:<event.code>` (`code:Digit1`, `code:Digit2`, `code:Quote`). Alt combos never match. `[]` for actions with no default key. */
  chords: readonly string[];
  label: string;                       // button aria-label / menu item text / toolbar aria-label
  group: ShortcutGroup;
  mutating: boolean;                   // not handled for read-only members
  viewerVisible: boolean;              // cheat-sheet row shown to viewers
  handledBy?: 'keydown' | 'paste-event';   // 'paste-event' chords are never matched on keydown (D-10f)
}
export const SHORTCUTS: readonly ShortcutBinding[];
export const RESERVED_CHORDS: Readonly<Record<string, string>>;
export const KEYLESS: ReadonlySet<ShortcutAction>;          // actions whose binding has chords: [] (Task 4: resetZoom; Task 5: alignCenterH, alignMiddleV, distributeH, distributeV)
export const MUTATING: ReadonlySet<ShortcutAction>;         // derived: bindings with mutating: true
export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;
export function normaliseChord(e: KeyEventLike): string | null;   // key form (`mod+shift+z`, `r`, `+`, `Escape`); null when altKey
export function matchShortcut(e: KeyEventLike): ShortcutAction | null;   // looks up `[mod+][shift+]code:<e.code>` first, then normaliseChord(e); skips handledBy 'paste-event'
export function bindingFor(action: ShortcutAction): ShortcutBinding;
export function formatKeys(action: ShortcutAction, platform: Platform): string;   // first chord; '' for KEYLESS
export function cheatSheetKeys(action: ShortcutAction): string;                    // platform-neutral `⌘/Ctrl+C`, `Shift+2`, `R`
export function ariaKeyShortcuts(action: ShortcutAction): string;                  // W3C: "Control+Shift+z Meta+Shift+z"; '' for KEYLESS
export function checkRegistry(bindings: readonly ShortcutBinding[], reserved: Readonly<Record<string, string>>): void;   // throws Error(`Duplicate chord "${chord}"`) — the test's checker
```

Display rules `formatKeys` must satisfy (the ten v1 strings are a frozen snapshot): mac with `mod` → glyphs with no separator (`⌘Z`, `⌘⇧Z`, `⌘⇧←`); every other case → `+`-joined words (`Ctrl+Shift+Z`, `Shift+1` on both platforms, `Ctrl+'`); key display: letters upper-case, `code:Digit1` → `1`, `code:Digit2` → `2`, `code:Quote` → `'`, `ArrowLeft/Right/Up/Down` → `←/→/↑/↓`, `Escape` → `Esc`, `Delete` → `Del`, `-` → `−` (U+2212, v1), `+`/`=`/`?` unchanged. `ariaKeyShortcuts`: each chord with `mod` yields `Control+…` and `Meta+…` variants joined by a space; keys are W3C names (`z`, `ArrowLeft`, `'`, `1`; `+` is written `Plus`). `cheatSheetKeys`: `mod` → `⌘/Ctrl+`, shift → `Shift+`, same key display.

v1 bindings to register (labels become the bar/menu copy): `undo ['mod+z'] 'Undo' history mutating`, `redo ['mod+shift+z','mod+y'] 'Redo' history mutating`, `zoomIn ['+','='] 'Zoom in' navigate viewerVisible`, `zoomOut ['-'] 'Zoom out' navigate viewerVisible`, `fitView ['shift+code:Digit1'] 'Fit view' navigate viewerVisible`, `clearSelection ['Escape'] 'Clear selection' select`, `selectAll ['mod+a'] 'Select all' select`, `duplicate ['mod+d'] 'Duplicate' edit mutating`, `delete ['Delete','Backspace'] 'Delete' edit mutating`, `cheatSheet ['?'] 'Keyboard shortcuts' help viewerVisible`.

`lib/canvas/shortcuts.ts` after this task: re-exports `ShortcutAction`, `Platform`, `MUTATING`, `matchShortcut`, `formatKeys` from the registry; keeps `isEditableTarget`, `hasOpenOverlay`, `detectPlatform`, `ShortcutRow`, `SHORTCUT_ROWS` where `SHORTCUT_ROWS = [...TEN_VERBATIM_ROWS, ...REGISTRY_ROWS]` and `REGISTRY_ROWS` is built from a table `{ action: string; actions: ShortcutAction[]; viewerVisible }[]` whose `input` is `actions.map(a => \`\\\`${cheatSheetKeys(a)}\\\`\`).join(' · ')`. In this task the table has the four v1 rows (`Select all` [selectAll], `Duplicate` [duplicate], `Clear selection` [clearSelection], `Keyboard shortcuts` [cheatSheet]) so the v1 copy test passes unchanged.

- [ ] **Step 1: Write the failing registry tests**

`tests/unit/canvas/registry.test.ts` (TC-029, TC-030; uses the same `key(k, mods, code)` helper as `shortcuts.test.ts`):

```ts
describe('registry (F10 AC-025)', () => {
  it('has no duplicate chord across SHORTCUTS and RESERVED_CHORDS, and every keyed action has a chord', () => {
    const all = [...SHORTCUTS.flatMap((b) => b.chords), ...Object.keys(RESERVED_CHORDS)];
    expect(new Set(all).size).toBe(all.length);
    for (const b of SHORTCUTS) expect(b.chords.length > 0 || KEYLESS.has(b.action), b.action).toBe(true);
    expect(() => checkRegistry(SHORTCUTS, RESERVED_CHORDS)).not.toThrow();
    expect(() => checkRegistry([...SHORTCUTS, { ...bindingFor('copy' /* Task 3; use 'undo' + chords ['mod+c'] until then */), chords: ['mod+a'] }], RESERVED_CHORDS)).toThrow(/Duplicate chord "mod\+a"/);
    expect(() => checkRegistry(SHORTCUTS, { ...RESERVED_CHORDS, d: 'x' })).toThrow(/"d"/);   // reserved letter colliding with a binding (added in Task 3; until then use 'Escape')
  });
  it('keeps the ten v1 labels verbatim and renders W3C aria strings', () => {
    const v1: [ShortcutAction, string, string][] = [
      ['undo', '⌘Z', 'Ctrl+Z'], ['redo', '⌘⇧Z', 'Ctrl+Shift+Z'], ['selectAll', '⌘A', 'Ctrl+A'], ['duplicate', '⌘D', 'Ctrl+D'],
      ['zoomIn', '+', '+'], ['zoomOut', '−', '−'], ['fitView', 'Shift+1', 'Shift+1'], ['clearSelection', 'Esc', 'Esc'], ['delete', 'Del', 'Del'], ['cheatSheet', '?', '?'],
    ];
    for (const [action, mac, other] of v1) { expect(formatKeys(action, 'mac')).toBe(mac); expect(formatKeys(action, 'other')).toBe(other); }
    expect(ariaKeyShortcuts('redo')).toBe('Control+Shift+z Meta+Shift+z');
    expect(ariaKeyShortcuts('zoomIn')).toBe('Plus =');
    expect(ariaKeyShortcuts('fitView')).toBe('Shift+1');
    expect(cheatSheetKeys('redo')).toBe('⌘/Ctrl+Shift+Z');
  });
  it('matchShortcut: code chords, symbols ignore shift, letters need no modifier, reserved letters are inert (AC-027 pure)', () => {
    expect(matchShortcut(key('!', { shiftKey: true }, 'Digit1'))).toBe('fitView');
    expect(matchShortcut(key('+', { shiftKey: true }))).toBe('zoomIn');
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    for (const k of ['t', 'n', 'f', 'x', 'i', 'k']) expect(matchShortcut(key(k)), k).toBeNull();
    expect(matchShortcut(key('r', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key('h', { altKey: true }))).toBeNull();
    expect(matchShortcut(key('R', { shiftKey: true }))).toBeNull();
  });
});
```

(Task 3 extends the third case with `r d o p c h` → `insert*`, `R` with no shift → `insertRectangle`, `mod+v` → null; Task 4 adds `mod+'`/`shift+Digit2`; Task 5 adds `mod+shift+ArrowLeft`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/canvas/registry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/canvas/registry'`.

- [ ] **Step 3: Implement `lib/canvas/registry.ts`** with the exports in the Interfaces block, the ten v1 bindings and `RESERVED_CHORDS`. `normaliseChord`: `altKey → null`; `mod = metaKey || ctrlKey`; `key.length === 1` → letter (`/[a-z]/i`) keeps `shift+`, symbol drops it; named keys keep `shift+`. `matchShortcut` builds a `Map<chord, action>` once (module scope) from bindings whose `handledBy !== 'paste-event'`. `checkRegistry` is called at module load (so a duplicate throws at import, failing every test and the build).

- [ ] **Step 4: Re-implement `lib/canvas/shortcuts.ts` over the registry** (re-exports + `REGISTRY_ROWS` table; `isEditableTarget`, `hasOpenOverlay`, `detectPlatform` unchanged).

- [ ] **Step 5: Run the registry and v1 tests**

Run: `npx vitest run tests/unit/canvas tests/unit/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS, including the unchanged `shortcuts.test.ts` (v1 `matchShortcut` cases, AC-019 verbatim rows and the four trailing v1 row names).

- [ ] **Step 6: Quality gate and commit 1**

Run: `npm run check` → expected: typecheck, lint, vitest all green, `prisma validate` OK.

```bash
git add lib/canvas/registry.ts lib/canvas/shortcuts.ts tests/unit/canvas/registry.test.ts
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): shortcut registry with duplicate-binding guard, formatKeys and aria-keyshortcuts"
```

---

### Task 2: Clipboard core and the F22 kind shim (spec T-010, pure half) — part of commit 2

**Files:**
- Create: `lib/canvas/kinds.ts`
- Create: `lib/canvas/clipboard.ts`
- Create: `tests/unit/canvas/clipboard.test.ts`

**Interfaces:**
- Consumes: `toDocument` (`lib/canvas/serialize.ts:44`), `PersistedNodeSchema`/`PersistedEdgeSchema`/`migrate` (`lib/canvas/schema.ts`), `newNodeId`/`newEdgeId` (`lib/canvas/ids.ts`), `CANVAS_SCHEMA_VERSION`, `DEFAULT_SIZES`.
- Produces:

```ts
// lib/canvas/kinds.ts — the only F22-aware module (D-10j). Reads through widened types so it compiles with or without F22.
import * as canvasTypes from '@/types/canvas';
export function canvasKinds(): readonly string[];        // (canvasTypes as { NODE_KINDS?: readonly string[] }).NODE_KINDS ?? NODE_SHAPES
export function hasTextKind(): boolean;                   // canvasKinds().includes('text')
export function textMaxLength(): number;                  // (canvasTypes as { TEXT_MAX_LENGTH?: number }).TEXT_MAX_LENGTH ?? MAX_LABEL (500)
export type TextInserter = (position: XYPosition, init: { label: string }) => unknown;
export function textInserter(mutations: object): TextInserter | null;   // hasTextKind() && typeof (mutations as { addNodeOfKind?: unknown }).addNodeOfKind === 'function' ? bound 'text' call : null

// lib/canvas/clipboard.ts
export const CLIPBOARD_TYPE = 'drawarc-clipboard';
export const CLIPBOARD_MAX_CHARS = 1_000_000; export const CLIPBOARD_MAX_NODES = 500; export const CLIPBOARD_MAX_EDGES = 1_000;
export const ClipboardEnvelopeSchema: z.ZodType<…>;   // z.object({ type: z.literal(CLIPBOARD_TYPE), schemaVersion: z.number().int().min(1).max(CANVAS_SCHEMA_VERSION), nodes: z.array(PersistedNodeSchema).max(500), edges: z.array(PersistedEdgeSchema).max(1000) }).strict()
export type ClipboardEnvelope = z.infer<typeof ClipboardEnvelopeSchema>;
export type ParsedClipboard = { kind: 'envelope'; envelope: ClipboardEnvelope } | { kind: 'text'; text: string } | { kind: 'none' };
export function serializeSelection(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): ClipboardEnvelope;   // selected nodes + edges whose both ends are selected, via toDocument
export function parseClipboardText(text: string): ParsedClipboard;
export function placePasted(env: ClipboardEnvelope, centre: XYPosition): { nodes: CanvasNode[]; edges: CanvasEdge[] };
export const memoryClipboard: { text: string | null };
export function writeClipboardText(text: string): Promise<void>;
export function readClipboardText(): Promise<string | null>;
```

`parseClipboardText` decisions: length > `CLIPBOARD_MAX_CHARS` → `none`; trimmed empty → `none`; `JSON.parse` in try/catch; a parsed object with `type === CLIPBOARD_TYPE` is run through `migrate` then `ClipboardEnvelopeSchema.safeParse` — success → `envelope`, failure → **`none`** (a broken envelope must never become a 1 MB text node); any other text (including JSON of another shape, e.g. `{"type":"other"}`) → `text`. `placePasted`: bbox from `position` + `width`/`height`; translation = `centre − bboxCentre`; `idMap` from `newNodeId(node.data.shape)`; edges with both ends in `idMap` get `newEdgeId()` and remapped endpoints, others dropped; no rounding to the grid. `writeClipboardText`: set `memoryClipboard.text` first, then `await navigator.clipboard?.writeText(text)` in try/catch (errors swallowed). `readClipboardText`: `navigator.clipboard?.readText()` in try/catch; a non-empty result wins, otherwise `memoryClipboard.text`.

- [ ] **Step 1: Write the failing clipboard tests** (TC-032, TC-033 pure half, EC-026 size)

```ts
const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
const N1 = pnode('rectangle_01JBE0000000000000000000N1', 0, 0, 180, 80), N2 = pnode('circle_01JBE0000000000000000000N2', 200, 100, 96, 96);
const Z = pnode('rectangle_01JBE00000000000000000000Z', 500, 500, 100, 50);
const E1 = pedge('e_01JBE00000000000000000000E1', N1.id, N2.id), E2 = pedge('e_01JBE00000000000000000000E2', N1.id, 'rectangle_01JBE00000000000000000GHOST');
// serializeSelection case: pass E2 as N1→Z (Z unselected) so it is excluded; the placePasted case uses the ghost target above
const env = { type: 'drawarc-clipboard', schemaVersion: 1, nodes: [N1, N2], edges: [E1, E2] } as const;

it('placePasted re-ids, remaps, drops dangling edges, keeps the offset and centres the group (AC-030)', () => {
  const a = placePasted(env, { x: 1000, y: 500 });
  expect(a.nodes.map((n) => n.id)).toEqual([expect.stringMatching(new RegExp(`^rectangle_${ULID}$`)), expect.stringMatching(new RegExp(`^circle_${ULID}$`))]);
  expect(a.nodes[1].position.x - a.nodes[0].position.x).toBe(200);
  expect(a.nodes[1].position.y - a.nodes[0].position.y).toBe(100);
  // bbox of N1 (0..180, 0..80) ∪ N2 (200..296, 100..196) → centre (148, 98); after translation the centre is (1000, 500)
  expect(a.nodes[0].position).toEqual({ x: 1000 - 148, y: 500 - 98 });
  expect(a.edges).toHaveLength(1);
  expect(a.edges[0]).toMatchObject({ id: expect.stringMatching(new RegExp(`^e_${ULID}$`)), source: a.nodes[0].id, target: a.nodes[1].id });
  const b = placePasted(env, { x: 1000, y: 500 });
  expect(new Set([...a.nodes, ...b.nodes].map((n) => n.id)).size).toBe(4);
  for (const n of a.nodes) expect(Object.keys(n).sort()).toEqual(['data', 'height', 'id', 'position', 'type', 'width']);
});
it('parseClipboardText: cap → none, prose → text, v1 envelope → envelope, broken envelope → none (AC-030, AC-031, EC-016, EC-017)', () => {
  expect(parseClipboardText('x'.repeat(1_000_001))).toEqual({ kind: 'none' });
  expect(parseClipboardText('hello')).toEqual({ kind: 'text', text: 'hello' });
  expect(parseClipboardText('{"type":"other"}')).toEqual({ kind: 'text', text: '{"type":"other"}' });
  expect(parseClipboardText(JSON.stringify(env)).kind).toBe('envelope');
  expect(parseClipboardText(JSON.stringify({ ...env, schemaVersion: 99 }))).toEqual({ kind: 'none' });
  expect(parseClipboardText(JSON.stringify({ ...env, nodes: Array.from({ length: 501 }, (_, i) => pnode(`rectangle_${'0'.repeat(25)}${i % 10}`, i, 0, 100, 50)) }))).toEqual({ kind: 'none' });
  expect(parseClipboardText(JSON.stringify({ ...env, nodes: [{ ...N1, extra: 1 }] }))).toEqual({ kind: 'none' });
});
it('serializeSelection keeps only selected nodes and internal edges, with runtime keys stripped (AC-028 unit)', () => {
  const out = serializeSelection([{ ...node(N1), selected: true, dragging: true, measured: { width: 1, height: 1 } }, { ...node(N2), selected: true }, { ...node(Z), selected: false }], [edge(E1), edge(E2 /* N1→Z */)]);
  expect(out).toEqual({ type: 'drawarc-clipboard', schemaVersion: 1, nodes: [N1, N2], edges: [E1] });
});
it('writeClipboardText/readClipboardText survive a missing or rejecting navigator.clipboard (AC-029, EC-014, EC-015)', async () => {
  vi.stubGlobal('navigator', {});
  await expect(writeClipboardText('t1')).resolves.toBeUndefined();
  expect(memoryClipboard.text).toBe('t1');
  await expect(readClipboardText()).resolves.toBe('t1');
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')), readText: vi.fn().mockRejectedValue(new Error('denied')) } });
  await expect(writeClipboardText('t2')).resolves.toBeUndefined();
  await expect(readClipboardText()).resolves.toBe('t2');
  vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockResolvedValue('') } });
  await expect(readClipboardText()).resolves.toBe('t2');
  memoryClipboard.text = null;
  await expect(readClipboardText()).resolves.toBeNull();
});
it('places the 500-node perf fixture in one call with 500 fresh ids (EC-026 unit)', () => {
  const doc = JSON.parse(readFileSync('tests/fixtures/canvas/large-500-nodes.json', 'utf8'));
  const parsed = parseClipboardText(JSON.stringify({ type: 'drawarc-clipboard', ...doc }));
  expect(parsed.kind).toBe('envelope');
  const out = placePasted((parsed as { envelope: ClipboardEnvelope }).envelope, { x: 0, y: 0 });
  expect(new Set(out.nodes.map((n) => n.id)).size).toBe(500);
});
```

`pnode`/`pedge` build `PersistedNode`/`PersistedEdge` literals (`sourceHandle: 'right'`, `targetHandle: 'left'`); `node`/`edge` turn them into runtime objects.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/canvas/clipboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/canvas/kinds.ts` and `lib/canvas/clipboard.ts`** per the Interfaces block.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/canvas/clipboard.test.ts` → PASS (5 tests).

(No commit yet — Task 3 completes commit 2.)

---

### Task 3: Pointer, `moveNodes`, clipboard/insert actions, capture-phase keyboard and `paste` listener (spec T-010 hook half + T-011) — completes commit 2

**Files:**
- Create: `hooks/usePointerPosition.ts`
- Modify: `hooks/useCanvasMutations.ts:17-30` (interface) and `:71-133` (`moveNodes`)
- Modify: `hooks/useCanvasActions.ts` (whole file)
- Modify: `hooks/useKeyboardShortcuts.ts` (whole file)
- Modify: `components/canvas/canvas-ergonomics.tsx:21-58` (pointer prop → actions)
- Modify: `components/canvas/flow-canvas.tsx:126-142` (own the pointer hook, pass `pointer` to `<CanvasErgonomics>`)
- Modify: `components/canvas/canvas-test-hooks.tsx` (`window.__clipboard`, `window.__rfStore`)
- Modify: `lib/canvas/registry.ts` (append the 9 bindings + union members), `lib/canvas/shortcuts.ts` (two cheat-sheet rows)
- Test: `tests/unit/hooks/useCanvasActions.test.tsx` (extend), `tests/unit/hooks/useKeyboardShortcuts.test.tsx` (extend), `tests/unit/hooks/useCanvasMutations.test.tsx` (one case), `tests/unit/canvas/registry.test.ts` (extend case 3)

**Interfaces:**
- Consumes: Task 1 registry; Task 2 `clipboard.ts`, `kinds.ts`; `centredDropPosition` (`lib/canvas/drop-position.ts:8`); `DEFAULT_SIZES`.
- Produces:

```ts
// hooks/usePointerPosition.ts — React Flow never calls onPaneMouseMove for editors (index.js L1647 routes
// onPointerMove to its own handler whenever selectionOnDrag is set, L2115–2124), so the pointer is tracked with
// native listeners on the flow container (store.getState().domNode): 'pointermove' stores clientX/Y in a ref,
// 'pointerleave' clears it. No React state, no re-render (NFR-004).
export type PointerRef = RefObject<XYPosition | null>;      // client coordinates
export function usePointerPosition(): PointerRef;          // must run under ReactFlowProvider; attaches once domNode exists

// hooks/useCanvasMutations.ts
moveNodes(moves: readonly { id: string; position: XYPosition }[]): void;   // one triggerNodeChanges([...replace]) = one undo entry; ids not in nodeLookup skipped; no call when empty

// hooks/useCanvasActions.ts
export interface CanvasActions {
  /* v1 unchanged */ canEdit; deleteSelection(); duplicateSelection(); selectAll(); clearSelection(); selectOnly(); zoomIn(); zoomOut(); fitView(); undo(); redo(); openCheatSheet();
  copy(): boolean;                     // false (and nothing written) with no node selected — the key then keeps its browser default
  cut(): boolean;                      // copy() then mutations.onDelete({ nodes: selected, edges: selectedEdges }) — one undo entry (same as Delete)
  paste(text: string): boolean;        // sync: parse → place at pointer/viewport centre → room.batch(addNodes + addEdge…) → selectOnly; text kind → textInserter; returns whether anything was written
  pasteFromClipboard(): Promise<void>; // menu path: await readClipboardText() → paste(text)
  insertShape(shape: NodeShape): void; // addNode(shape, centredDropPosition(flowPoint, DEFAULT_SIZES[shape])); flowPoint = screenToFlowPosition(pointer ?? containerCentre)
  // Task 4 adds: toggleGrid(); zoomToSelection(); resetZoom();   Task 5 adds: align(mode: AlignMode); distribute(axis: Axis)
}
export function useCanvasActions(openCheatSheet: () => void, pointer: PointerRef): CanvasActions;
export function runAction(action: ShortcutAction, actions: CanvasActions): boolean;   // exhaustive switch (never default); 'paste' → pasteFromClipboard(); copy/cut return their boolean; everything else returns true
```

`undo()`/`redo()` gain the FR-025 guard: `if (store.getState().nodes.some((n) => n.dragging || n.resizing)) return;`. Viewport centre = `domNode.getBoundingClientRect()` centre (the F07 `placeAtCentre` rule, `shape-palette.tsx:55-61`), converted with `rf.screenToFlowPosition`.

`useKeyboardShortcuts(actions)` after this task: `window.addEventListener('keydown', onKeyDown, { capture: true })`; ignore rules unchanged and first; `if (!actions.canEdit && MUTATING.has(action)) return;` then `if (!runAction(action, actions)) return; event.preventDefault(); event.stopPropagation();`. Plus `window.addEventListener('paste', onPaste)`: same ignore rules; `if (!actions.canEdit) return;` `const text = event.clipboardData?.getData('text/plain') ?? '';` `if (actions.paste(text)) event.preventDefault();`.

Registry additions (Task 1 grammar): `copy ['mod+c'] 'Copy' edit`, `cut ['mod+x'] 'Cut' edit mutating`, `paste ['mod+v'] 'Paste' edit mutating handledBy:'paste-event'`, `insertRectangle ['r'] 'Add rectangle' insert mutating`, `insertDiamond ['d']`, `insertCircle ['o']`, `insertPill ['p']`, `insertCylinder ['c']`, `insertHexagon ['h']`. Cheat-sheet rows appended after the four v1 rows: `{ action: 'Copy / Cut / Paste', actions: ['copy','cut','paste'], viewerVisible: false }`, `{ action: 'Add shape at pointer', actions: ['insertRectangle','insertDiamond','insertCircle','insertPill','insertCylinder','insertHexagon'], viewerVisible: false }`.

- [ ] **Step 1: Extend the registry test** (case 3): `for (const [k, a] of [['r','insertRectangle'],['d','insertDiamond'],['o','insertCircle'],['p','insertPill'],['c','insertCylinder'],['h','insertHexagon']]) expect(matchShortcut(key(k))).toBe(a);` `expect(matchShortcut(key('R'))).toBe('insertRectangle');` (CapsLock) `expect(matchShortcut(key('v', { ctrlKey: true }))).toBeNull();` `expect(formatKeys('paste', 'other')).toBe('Ctrl+V');` and switch the duplicate-check fixtures to the real `copy` binding with `chords: ['mod+a']` and `{ d: 'x' }`. Run → FAIL (`insertRectangle` not matched).

- [ ] **Step 2: Add the bindings and union members to `lib/canvas/registry.ts`, the two rows to `shortcuts.ts`**, and update the trailing-row assertion in `tests/unit/canvas/shortcuts.test.ts:76` to `['Select all', 'Duplicate', 'Clear selection', 'Keyboard shortcuts', 'Copy / Cut / Paste', 'Add shape at pointer']` (the ten verbatim rows and the viewer list at `:77-82` stay as they are in this task) → registry and shortcuts tests PASS; `useKeyboardShortcuts.ts` now fails `tsc` (non-exhaustive `run`) — expected until Step 6.

- [ ] **Step 3: Write the failing `moveNodes` case** in `useCanvasMutations.test.tsx` (uses `setup(true)` and `store.setState({ nodes: [...] })`):

```ts
it('moveNodes emits one replace change set with new positions and skips unknown ids (F10 v2 FR-020)', () => {
  const { result, onNodesChange } = setup(true);
  act(() => result.current.store.setState({ nodes: [n('A', 0, 0), n('B', 300, 200)] }));   // n(): CanvasNode 100×50 at (x, y)
  result.current.mutations.moveNodes([{ id: 'A', position: { x: 250, y: 0 } }, { id: 'ghost', position: { x: 1, y: 1 } }]);
  expect(onNodesChange).toHaveBeenCalledOnce();
  expect(onNodesChange.mock.calls[0][0]).toEqual([{ type: 'replace', id: 'A', item: expect.objectContaining({ id: 'A', position: { x: 250, y: 0 } }) }]);
  result.current.mutations.moveNodes([]);
  expect(onNodesChange).toHaveBeenCalledOnce();
});
```

- [ ] **Step 4: Write the failing action cases** in `useCanvasActions.test.tsx`. Extend the hoisted mocks: `useReactFlow` → `{ zoomIn, zoomOut, fitView, zoomTo: vi.fn(), screenToFlowPosition: vi.fn((p) => ({ x: p.x * 2, y: p.y * 2 })) }`; `h.state` gains `nodeLookup`, `domNode: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }`; `h.mutations` gains `addNode: vi.fn(() => log.push('addNode'))`, `moveNodes`; `vi.mock('@/lib/canvas/kinds', () => ({ textInserter: h.textInserter, hasTextKind: () => h.hasText, textMaxLength: () => 500 }))`; `const actions = (pointer: XYPosition | null = { x: 400, y: 300 }) => renderHook(() => useCanvasActions(() => {}, { current: pointer })).result.current;`

```ts
it('copy/cut serialise the selection, write memory + navigator, and cut deletes once (AC-028 unit, AC-029)', async () => {
  vi.stubGlobal('navigator', {});                       // EC-014
  h.state.nodes = [n('X', true), n('Y', true), n('Z', false)]; h.state.edges = [e('E', 'X', 'Y'), e('F', 'X', 'Z')];
  expect(actions().copy()).toBe(true);
  expect(JSON.parse(memoryClipboard.text!)).toMatchObject({ type: 'drawarc-clipboard', nodes: [{ id: 'X' }, { id: 'Y' }], edges: [{ id: 'E' }] });
  expect(h.log).toEqual([]);
  expect(actions().cut()).toBe(true);
  expect(h.mutations.onDelete).toHaveBeenCalledOnce();
  h.state.nodes = [n('X', false)];
  expect(actions().copy()).toBe(false); expect(actions().cut()).toBe(false);
});
it('paste places the envelope at the pointer (or the viewport centre), in one batch, then selects the copies (AC-030/032 unit, EC-019)', () => {
  const text = JSON.stringify(envelope /* N1 (0,0 180×80), N2 (200,100 96×96), E1, E2→ghost — as in clipboard.test */);
  expect(actions().paste(text)).toBe(true);
  expect(h.log).toEqual(['batch:start', 'addNodes', 'addEdge', 'batch:end']);
  const [added] = h.mutations.addNodes.mock.calls[0] as unknown as [CanvasNode[]];
  expect(added[0].position).toEqual({ x: 800 - 148, y: 600 - 98 });           // screenToFlowPosition(400,300) = (800,600)
  expect(h.state.triggerNodeChanges).toHaveBeenLastCalledWith(added.map((c) => ({ type: 'select', id: c.id, selected: true })));
  vi.clearAllMocks(); h.log.length = 0;
  actions(null).paste(text);                                                    // off-canvas → container centre (400,300) → (800,600)
  expect((h.mutations.addNodes.mock.calls[0] as unknown as [CanvasNode[]])[0][0].position).toEqual({ x: 800 - 148, y: 600 - 98 });
});
it('paste rejects every invalid envelope without a write, a selection change or a history entry (AC-031)', () => {
  for (const text of ['{"type":"other"}', JSON.stringify({ ...envelope, nodes: Array(501).fill(envelope.nodes[0]) }), JSON.stringify({ ...envelope, schemaVersion: 99 }), JSON.stringify({ ...envelope, nodes: [{ ...envelope.nodes[0], extra: 1 }] })]) {
    expect(actions().paste(text)).toBe(false);
  }
  expect(h.log).toEqual([]); expect(h.state.triggerNodeChanges).not.toHaveBeenCalled();
});
it('plain text becomes a text node only when the kind shim offers one (AC-033, FR-018)', () => {
  h.textInserter.mockReturnValue(null);
  expect(actions().paste('plain words')).toBe(false); expect(h.log).toEqual([]);
  const insert = vi.fn(); h.textInserter.mockReturnValue(insert);
  expect(actions().paste('plain words')).toBe(true);
  expect(insert).toHaveBeenCalledWith({ x: 800, y: 600 }, { label: 'plain words' });
});
it('pasteFromClipboard uses readText, falls back to memory, and is a no-op when both are empty (AC-029, EC-015)', async () => {
  vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockRejectedValue(new Error('denied')) } });
  memoryClipboard.text = JSON.stringify(envelope);
  await actions().pasteFromClipboard(); expect(h.mutations.addNodes).toHaveBeenCalledOnce();
  vi.clearAllMocks(); memoryClipboard.text = null;
  await actions().pasteFromClipboard(); expect(h.mutations.addNodes).not.toHaveBeenCalled();
});
it('insertShape centres the node on the pointer, or on the viewport centre without one (AC-027 hook half)', () => {
  actions().insertShape('rectangle');
  expect(h.mutations.addNode).toHaveBeenCalledWith('rectangle', { x: 800 - 90, y: 600 - 40 });
  actions(null).insertShape('circle');
  expect(h.mutations.addNode).toHaveBeenLastCalledWith('circle', { x: 800 - 48, y: 600 - 48 });
});
it('undo/redo are ignored mid-drag or mid-resize (FR-025, AC-041 unit)', () => {
  h.state.nodes = [{ ...n('X', true), dragging: true }];
  actions().undo(); actions().redo(); expect(h.log).toEqual([]);
  h.state.nodes = [{ ...n('X', true), resizing: true }];
  actions().undo(); expect(h.log).toEqual([]);
  h.state.nodes = [n('X', true)];
  actions().undo(); expect(h.log).toEqual(['undo']);
});
```

Add to the existing read-only case: `a.cut(); a.paste(JSON.stringify(envelope)); a.insertShape('rectangle');` — `h.log` still `[]`.

- [ ] **Step 5: Write the failing keyboard cases** in `useKeyboardShortcuts.test.tsx` (`makeActions` gains `copy: vi.fn(() => true)`, `cut`, `paste: vi.fn(() => true)`, `pasteFromClipboard`, `insertShape`, and — from Tasks 4/5 — `toggleGrid`, `zoomToSelection`, `resetZoom`, `align`, `distribute`):

```ts
it('runs in the capture phase: a focused node that preventDefaults its own keydown neither blocks nor sees a handled shortcut (D-10g, EC-027 unit)', () => {
  const actions = makeActions(); renderHook(() => useKeyboardShortcuts(actions));
  document.body.innerHTML = '<div class="react-flow__node" tabindex="0" id="n"></div>';
  const nodeEl = document.getElementById('n')!; const nodeSaw = vi.fn((e: Event) => e.preventDefault());
  nodeEl.addEventListener('keydown', nodeSaw);
  const ev = press(nodeEl, 'c', { ctrlKey: true });
  expect(actions.copy).toHaveBeenCalledOnce(); expect(ev.defaultPrevented).toBe(true); expect(nodeSaw).not.toHaveBeenCalled();
  press(nodeEl, 'k'); expect(nodeSaw).toHaveBeenCalledOnce();      // unhandled keys still reach the node
});
it('letter keys insert for editors only; copy with nothing selected keeps the browser default (AC-027, FR-016)', () => {
  const actions = makeActions(); renderHook(() => useKeyboardShortcuts(actions));
  expect(press(document.body, 'r').defaultPrevented).toBe(true); expect(actions.insertShape).toHaveBeenCalledWith('rectangle');
  expect(press(document.body, 'r', { ctrlKey: true }).defaultPrevented).toBe(false);
  (actions.copy as Mock).mockReturnValue(false);
  expect(press(document.body, 'c', { ctrlKey: true }).defaultPrevented).toBe(false);
  const viewer = makeActions(false); renderHook(() => useKeyboardShortcuts(viewer));
  press(document.body, 'h'); expect(viewer.insertShape).not.toHaveBeenCalled();
});
it('Ctrl+V is left to the paste event, which is prevented only when something was written (D-10f)', () => {
  const actions = makeActions(); renderHook(() => useKeyboardShortcuts(actions));
  expect(press(document.body, 'v', { ctrlKey: true }).defaultPrevented).toBe(false);
  const paste = (text: string, target: EventTarget = document.body) => { const ev = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent; Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } }); target.dispatchEvent(ev); return ev; };
  expect(paste('{"type":"drawarc-clipboard"}').defaultPrevented).toBe(true); expect(actions.paste).toHaveBeenCalledWith('{"type":"drawarc-clipboard"}');
  (actions.paste as Mock).mockReturnValue(false);
  expect(paste('nothing').defaultPrevented).toBe(false);
  document.body.innerHTML = '<textarea id="t"></textarea>';
  paste('x', document.getElementById('t')!); expect(actions.paste).toHaveBeenCalledTimes(2);   // not intercepted in a text field
  const viewer = makeActions(false); renderHook(() => useKeyboardShortcuts(viewer));
  paste('{"type":"drawarc-clipboard"}'); expect(viewer.paste).not.toHaveBeenCalled();
});
```

Extend the v1 "ignores keys in overlays" case: inside the open dialog press `c` with Ctrl, `r`, and `ArrowLeft` with `ctrlKey+shiftKey`, and dispatch a `paste` event — every action still uncalled (Review Focus 5).

- [ ] **Step 6: Implement** `usePointerPosition.ts`, `moveNodes`, the `useCanvasActions` additions + `runAction`, the capture/paste listeners, the `pointer` prop in `canvas-ergonomics.tsx` (`CanvasErgonomics({ children, pointer })`) wired from `flow-canvas.tsx` `CanvasSurface` (`const pointer = usePointerPosition();`), and the test hooks: `window.__clipboard = memoryClipboard`, `window.__rfStore = useStoreApi()` (declare both in the `Window` augmentation).

- [ ] **Step 7: Run the hook suites and the flow-canvas guard**

Run: `npx vitest run tests/unit/hooks tests/unit/canvas tests/unit/components/flow-canvas.test.tsx`
Expected: PASS (v1 cases unchanged; `flow-canvas.test.tsx` passes untouched because `CanvasErgonomics` renders for real and the pointer hook attaches lazily to `domNode`).

- [ ] **Step 8: Quality gate and commit 2**

Run: `npm run check` → green.

```bash
git add lib/canvas/registry.ts lib/canvas/shortcuts.ts lib/canvas/clipboard.ts lib/canvas/kinds.ts hooks/usePointerPosition.ts hooks/useCanvasMutations.ts hooks/useCanvasActions.ts hooks/useKeyboardShortcuts.ts components/canvas/canvas-ergonomics.tsx components/canvas/flow-canvas.tsx components/canvas/canvas-test-hooks.tsx tests/unit/canvas/registry.test.ts tests/unit/canvas/clipboard.test.ts tests/unit/hooks/useCanvasActions.test.tsx tests/unit/hooks/useKeyboardShortcuts.test.tsx tests/unit/hooks/useCanvasMutations.test.tsx
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): clipboard copy/cut/paste, letter-key insertion and capture-phase shortcuts"
```

---
### Task 4: Grid preference, zoom readout and limits, control bar v2 (spec T-012) — commit 3

**Files:**
- Create: `lib/canvas/preferences.ts`, `hooks/useGrid.ts`
- Modify: `components/canvas/canvas-controls.tsx` (whole file), `components/canvas/flow-canvas.tsx:143-176` (grid props, `Background` variant), `hooks/useCanvasActions.ts` (three actions), `lib/canvas/registry.ts` (three bindings), `lib/canvas/shortcuts.ts` (two rows), `tests/e2e/ergonomics.spec.ts:57` (v1 AC-001 label list — see Task 6)
- Create: `tests/unit/canvas/preferences.test.ts`, `tests/unit/components/canvas/canvas-controls.test.tsx` (new — the spec says "extended" but no control-bar unit test exists)
- Test: `tests/unit/components/flow-canvas.test.tsx` (extend the prop guard), `tests/unit/canvas/registry.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 `ariaKeyShortcuts`, `formatKeys`, `bindingFor`; Task 3 `runAction`, `CanvasActions`.
- Produces:

```ts
// lib/canvas/preferences.ts (no React)
export const GRID_STORAGE_KEY = 'drawarc.grid';
export const GRID_SIZE = 20;
export const SNAP_GRID: SnapGrid = [GRID_SIZE, GRID_SIZE];   // module constant, stable identity
export const gridStore: { subscribe(cb: () => void): () => void; get(): boolean; set(value: boolean): void };
// memory value is the truth: initialised once from localStorage.getItem(KEY) === '1' inside try/catch; set() updates memory,
// notifies subscribers, then setItem('1') / removeItem inside try/catch (EC-023). Server/SSR snapshot: false.

// hooks/useGrid.ts
export function useGrid(): boolean;    // useSyncExternalStore(gridStore.subscribe, gridStore.get, () => false)

// hooks/useCanvasActions.ts additions
toggleGrid(): void;                    // gridStore.set(!gridStore.get()); allowed for viewers; no history entry
zoomToSelection(): void;               // selected = nodes.filter(n => n.selected); selected.length ? rf.fitView({ nodes: selected.map(n => ({ id: n.id })), duration: 200, padding: 0.2 }) : rf.fitView(FIT)
resetZoom(): void;                     // rf.zoomTo(1, { duration: 200 })

// components/canvas/canvas-controls.tsx
export interface CanvasControlsProps { actions: Pick<CanvasActions, 'canEdit' | 'zoomIn' | 'zoomOut' | 'fitView' | 'undo' | 'redo' | 'toggleGrid' | 'resetZoom'>; platform: Platform }
// order: Zoom out · <ZoomReadout/> · Zoom in · Fit view · Grid · separator · Undo · Redo; every ControlButton renders aria-keyshortcuts={ariaKeyShortcuts(shortcut) || undefined}
// ZoomReadout: <button data-slot="zoom-readout" aria-label={`Zoom ${pct} %, reset to 100 %`} className="tabular-nums min-w-14 …" onClick={actions.resetZoom}>{pct} %</button>, pct = Math.round(useStore((s) => s.transform[2]) * 100)
// Zoom in disabled = useStore((s) => s.transform[2] >= s.maxZoom - 1e-6); Zoom out disabled = useStore((s) => s.transform[2] <= s.minZoom + 1e-6)
// Grid: ControlButton with shortcut 'toggleGrid', icon Grid3x3, aria-pressed={useGrid()}
```

Registry additions: `toggleGrid ['mod+code:Quote'] 'Grid' navigate viewerVisible`, `zoomToSelection ['shift+code:Digit2'] 'Zoom to selection' navigate viewerVisible`, `resetZoom [] 'Reset zoom' navigate viewerVisible` (added to `KEYLESS`). Rows: `{ action: 'Grid', actions: ['toggleGrid'], viewerVisible: true }`, `{ action: 'Zoom to selection', actions: ['zoomToSelection'], viewerVisible: true }` (appended after the Task 3 rows; the Align row from Task 5 goes between them — final order: Copy / Cut / Paste · Add shape at pointer · Grid · Align · Zoom to selection).

`flow-canvas.tsx`: `const grid = useGrid();` in `CanvasSurface`; `<ReactFlow … snapToGrid={grid} snapGrid={SNAP_GRID}>`; `<Background variant={grid ? BackgroundVariant.Lines : BackgroundVariant.Dots} gap={GRID_SIZE} color="var(--border-default)" />`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/canvas/preferences.test.ts` (TC-037):

```ts
it('defaults off, persists "1" in localStorage, and notifies subscribers (FR-019)', async () => {
  localStorage.clear(); vi.resetModules();
  const { gridStore, GRID_STORAGE_KEY } = await import('@/lib/canvas/preferences');   // fresh module per case
  const cb = vi.fn(); const off = gridStore.subscribe(cb);
  expect(gridStore.get()).toBe(false);
  gridStore.set(true); expect(cb).toHaveBeenCalledOnce(); expect(localStorage.getItem(GRID_STORAGE_KEY)).toBe('1');
  gridStore.set(false); expect(localStorage.getItem(GRID_STORAGE_KEY)).toBeNull(); off();
});
it('reads an existing "1" at load and keeps working when localStorage throws (EC-023, AC-035)', async () => {
  localStorage.setItem('drawarc.grid', '1'); vi.resetModules();
  expect((await import('@/lib/canvas/preferences')).gridStore.get()).toBe(true);
  vi.resetModules();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const { gridStore } = await import('@/lib/canvas/preferences');
  expect(gridStore.get()).toBe(false); expect(() => gridStore.set(true)).not.toThrow(); expect(gridStore.get()).toBe(true);
});
```

`tests/unit/components/canvas/canvas-controls.test.tsx` (TC-038 bar half, AC-026, AC-035 viewer, AC-040 unit). Mock `@liveblocks/react/suspense` `useRoom` → `{ events: { history: { subscribe: () => () => {} } }, history: { canUndo: () => false, canRedo: () => false } }`; render inside `TooltipProvider` + `ReactFlowProvider` with a probe child that exposes `useStoreApi()` so the test can `setState({ transform: [0, 0, z], minZoom: 0.1, maxZoom: 4 })`; `actions` = `vi.fn()` per key, `platform: 'other'`.

```ts
it('renders the v2 order, hints and aria-keyshortcuts from the registry for an editor (AC-026, FR-024 UX)', () => {
  renderBar({ canEdit: true });
  expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Zoom out', 'Zoom 100 %, reset to 100 %', 'Zoom in', 'Fit view', 'Grid', 'Undo', 'Redo']);
  for (const [label, action] of [['Zoom out', 'zoomOut'], ['Zoom in', 'zoomIn'], ['Fit view', 'fitView'], ['Grid', 'toggleGrid'], ['Undo', 'undo'], ['Redo', 'redo']] as const) {
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-keyshortcuts', ariaKeyShortcuts(action));
  }
  expect(screen.getByRole('button', { name: /reset to 100 %/ })).not.toHaveAttribute('aria-keyshortcuts');
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false');
});
it('a viewer gets the first five controls including a working Grid toggle (AC-035)', async () => {
  const { actions } = renderBar({ canEdit: false });
  expect(screen.getAllByRole('button')).toHaveLength(5);
  await userEvent.click(screen.getByRole('button', { name: 'Grid' })); expect(actions.toggleGrid).toHaveBeenCalledOnce();
});
it('readout follows the zoom, resets on click, and the limit buttons disable at 4 and 0.1 (AC-040 unit, EC-025)', async () => {
  const { actions, store } = renderBar({ canEdit: true });
  act(() => store.setState({ transform: [0, 0, 4], minZoom: 0.1, maxZoom: 4 }));
  expect(screen.getByRole('button', { name: 'Zoom 400 %, reset to 100 %' })).toHaveTextContent('400 %');
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  act(() => store.setState({ transform: [0, 0, 0.1] }));
  expect(screen.getByRole('button', { name: 'Zoom 10 %, reset to 100 %' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: /reset to 100 %/ })); expect(actions.resetZoom).toHaveBeenCalledOnce();
});
```

`flow-canvas.test.tsx`: add to the prop guard `expect(props).toMatchObject({ snapToGrid: false, snapGrid: [20, 20] })`, then `act(() => gridStore.set(true))` → last captured props `snapToGrid: true` (import `gridStore`; reset to `false` in `afterEach`).

`registry.test.ts`: `expect(matchShortcut(key("'", { ctrlKey: true }, 'Quote'))).toBe('toggleGrid'); expect(matchShortcut(key('@', { shiftKey: true }, 'Digit2'))).toBe('zoomToSelection'); expect(formatKeys('toggleGrid', 'other')).toBe("Ctrl+'"); expect(formatKeys('toggleGrid', 'mac')).toBe("⌘'"); expect(formatKeys('zoomToSelection', 'mac')).toBe('Shift+2'); expect(ariaKeyShortcuts('toggleGrid')).toBe("Control+' Meta+'"); expect(formatKeys('resetZoom', 'other')).toBe('');`

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/canvas/preferences.test.ts tests/unit/components/canvas/canvas-controls.test.tsx tests/unit/components/flow-canvas.test.tsx tests/unit/canvas/registry.test.ts`
Expected: FAIL (modules missing / labels differ).

- [ ] **Step 3: Implement** `preferences.ts`, `useGrid.ts`, the three actions (+ `runAction` cases + `makeActions` mocks in the keyboard test), registry bindings and rows, `canvas-controls.tsx`, `flow-canvas.tsx` grid props.

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command plus `tests/unit/hooks tests/unit/canvas/shortcuts.test.ts` → PASS after updating `shortcuts.test.ts:76` (append `'Grid', 'Zoom to selection'`) and `:77-82` (viewer-visible names become `['Pan', 'Zoom', 'Fit view', 'Keyboard shortcuts', 'Grid', 'Zoom to selection']`); the ten verbatim rows are untouched.

- [ ] **Step 5: Quality gate and commit 3**

Run: `npm run check` → green.

```bash
git add lib/canvas/preferences.ts hooks/useGrid.ts lib/canvas/registry.ts lib/canvas/shortcuts.ts hooks/useCanvasActions.ts components/canvas/canvas-controls.tsx components/canvas/flow-canvas.tsx tests/unit/canvas/preferences.test.ts tests/unit/components/canvas/canvas-controls.test.tsx tests/unit/components/flow-canvas.test.tsx tests/unit/canvas/registry.test.ts tests/unit/hooks/useKeyboardShortcuts.test.tsx
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): per-user 20 px grid, zoom readout with limits, Shift+2 zoom to selection"
```

---
### Task 5: Align/distribute helpers, selection toolbar, context menu v2 (spec T-013) — commit 4

**Files:**
- Create: `lib/canvas/align.ts`, `hooks/useArrange.ts`, `components/canvas/selection-toolbar.tsx`
- Modify: `components/canvas/canvas-context-menu.tsx` (menu body `:214-262` → entry model), `components/canvas/canvas-editor.tsx:42` (mount `<SelectionToolbar />` after `<NodeColorToolbar />`), `hooks/useCanvasActions.ts` (two actions via `useArrange`), `lib/canvas/registry.ts` (eight bindings), `lib/canvas/shortcuts.ts` (Align row)
- Create: `tests/unit/canvas/align.test.ts`, `tests/unit/components/canvas/canvas-context-menu.test.tsx` (new — pure entry model; no v1 menu unit test exists)
- Test: `tests/unit/hooks/useCanvasActions.test.tsx` (one case), `tests/unit/canvas/registry.test.ts` (extend)

**Interfaces:**
- Consumes: Task 3 `moveNodes`, `runAction`, `bindingFor`; `useSelectedNodeIds` (`hooks/useSelectedNodeIds.ts:18`); `NodeToolbar` pattern of `node-color-toolbar.tsx:60`.
- Produces:

```ts
// lib/canvas/align.ts (pure)
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'middleV';   // centerH = equal x-centres; middleV = equal y-centres
export type Axis = 'h' | 'v';
export interface NodeBox { id: string; x: number; y: number; width: number; height: number; locked?: boolean }
export function isLocked(data: Record<string, unknown>): boolean;                    // data.locked === true (F22 optional field)
export function selectedBoxes(nodes: readonly CanvasNode[]): NodeBox[];              // selected nodes → boxes; width/height = node.width ?? node.measured?.width ?? DEFAULT_SIZES[shape] (the persistNode rule)
export function alignNodes(boxes: readonly NodeBox[], mode: AlignMode): { id: string; position: XYPosition }[];   // movable = !locked; [] if movable < 2; bbox over movable only; returns only boxes whose position changes, input order
export function distributeNodes(boxes: readonly NodeBox[], axis: Axis): { id: string; position: XYPosition }[]; // movable sorted by x (or y), ties by id; first/last fixed; gap = (span − Σsize) / (n − 1); [] if movable < 3

// hooks/useArrange.ts — shared by useCanvasActions and SelectionToolbar
export function useArrange(): { align(mode: AlignMode): void; distribute(axis: Axis): void };   // moves = helper(selectedBoxes(store.getState().nodes)); if (moves.length) mutations.moveNodes(moves)

// components/canvas/canvas-context-menu.tsx (exported for the unit test)
export type MenuEntry = { kind: 'item'; action: ShortcutAction; danger?: boolean } | { kind: 'separator' } | { kind: 'submenu'; label: 'Align'; items: MenuEntry[] };
export interface MenuContext { canEdit: boolean; movableSelected: number }   // movableSelected = selected nodes with !isLocked(data)
export function menuEntries(target: ContextTarget, ctx: MenuContext): MenuEntry[];   // predicates applied, separators collapsed (none leading/trailing/doubled)
// item text = bindingFor(action).label; hint = formatKeys(action, platform) (omitted when ''); aria-keyshortcuts = ariaKeyShortcuts(action) (omitted when ''); onSelect = () => runAction(action, actions)

// components/canvas/selection-toolbar.tsx — mounted inside <ReactFlow> (canvas-editor.tsx); null unless canEdit && ids.length >= 2
export function SelectionToolbar(): JSX.Element | null;
// <NodeToolbar nodeId={ids} isVisible position={Position.Bottom} offset={12} align="center" className="nodrag nopan"><div role="toolbar" aria-label="Arrange selection">…</div></NodeToolbar>
// buttons in order: alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, then (ids.length >= 3) distributeH, distributeV;
// each: aria-label = binding label, Tooltip "label (hint)" (hint only when bound), aria-keyshortcuts when bound, icons AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
```

Menu composition (`menuEntries`): node/selection → `copy, cut, paste, duplicate, separator, submenu Align [alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, separator, distributeH, distributeV], zoomToSelection, separator, delete(danger)`; submenu only when `movableSelected >= 2`, its distribute items only when `>= 3`; edge → `delete(danger)`; pane → `paste (canEdit), selectAll (canEdit), fitView, zoomToSelection, cheatSheet`. Render submenu with `ContextMenuSub`/`ContextMenuSubTrigger`/`ContextMenuSubContent` (already exported by `components/ui/context-menu.tsx:247-249`). `movableSelected` comes from `useStore((s) => s.nodes.reduce((n, node) => n + (node.selected && !isLocked(node.data) ? 1 : 0), 0))`.

Registry additions: `alignLeft ['mod+shift+ArrowLeft'] 'Align left' arrange mutating`, `alignRight ['mod+shift+ArrowRight'] 'Align right'`, `alignTop ['mod+shift+ArrowUp'] 'Align top'`, `alignBottom ['mod+shift+ArrowDown'] 'Align bottom'`, `alignCenterH [] 'Align centre (horizontal)'`, `alignMiddleV [] 'Align middle (vertical)'`, `distributeH [] 'Distribute horizontally'`, `distributeV [] 'Distribute vertically'` (the four keyless join `KEYLESS`). Row: `{ action: 'Align', actions: ['alignLeft','alignRight','alignTop','alignBottom'], viewerVisible: false }` inserted before the Grid row? — no: order is Copy/Cut/Paste · Add shape at pointer · Grid · Align · Zoom to selection (spec UX list). The row renders the four derived chords (`⌘/Ctrl+Shift+←` …) instead of the spec's abbreviated `⌘/Ctrl+Shift+Arrow`, so no chord is hand-written (recorded in Spec gaps).

- [ ] **Step 1: Write the failing align tests** (TC-036, AC-036 vectors)

```ts
const A = { id: 'A', x: 0, y: 0, width: 100, height: 50 }, B = { id: 'B', x: 300, y: 200, width: 50, height: 50 };
const C = { id: 'C', x: 120, y: 80, width: 80, height: 80, locked: true }, D = { id: 'D', x: 150, y: 300, width: 60, height: 60 };
it('aligns the movable boxes to the bounding box of the movable set, ignoring locked ones (FR-020, EC-022)', () => {
  expect(alignNodes([A, B, C], 'left')).toEqual([{ id: 'B', position: { x: 0, y: 200 } }]);
  expect(alignNodes([A, B, C], 'right')).toEqual([{ id: 'A', position: { x: 250, y: 0 } }]);
  expect(alignNodes([A, B, C], 'top')).toEqual([{ id: 'B', position: { x: 300, y: 0 } }]);
  expect(alignNodes([A, B, C], 'bottom')).toEqual([{ id: 'A', position: { x: 0, y: 200 } }]);
  expect(alignNodes([A, B, C], 'centerH')).toEqual([{ id: 'A', position: { x: 125, y: 0 } }, { id: 'B', position: { x: 150, y: 200 } }]);
  expect(alignNodes([A, B, C], 'middleV')).toEqual([{ id: 'A', position: { x: 0, y: 100 } }, { id: 'B', position: { x: 300, y: 100 } }]);
});
it('returns [] for < 2 movable boxes and for an already-aligned set (EC-021)', () => {
  expect(alignNodes([A], 'left')).toEqual([]);
  expect(alignNodes([A, C], 'left')).toEqual([]);
  expect(alignNodes([A, { ...B, x: 0 }], 'left')).toEqual([]);
});
it('distributes with equal gaps, outer boxes fixed, locked excluded; [] below 3 movable (FR-021)', () => {
  expect(distributeNodes([A, B, C, D], 'h')).toEqual([{ id: 'D', position: { x: 170, y: 300 } }]);   // span 0..350, sizes 100+60+50 → gap 70
  expect(distributeNodes([A, B, C, D], 'v')).toEqual([{ id: 'B', position: { x: 300, y: 150 } }]);   // span 0..360, sizes 50+50+60 → gap 100
  expect(distributeNodes([A, B, C], 'h')).toEqual([]);
  expect(distributeNodes([{ id: 'P', x: 0, y: 0, width: 80, height: 40 }, { id: 'Q', x: 50, y: 0, width: 80, height: 40 }, { id: 'R', x: 400, y: 0, width: 80, height: 40 }], 'h')).toEqual([{ id: 'Q', position: { x: 200, y: 0 } }]);   // AC-038 vector
});
it('selectedBoxes reads stored width/height and the optional locked flag', () => {
  const boxes = selectedBoxes([{ ...node('A'), selected: true, width: 100, height: 50 }, { ...node('L'), selected: true, data: { ...node('L').data, locked: true } as CanvasNodeData }, { ...node('U'), selected: false }]);
  expect(boxes.map((b) => [b.id, b.locked ?? false])).toEqual([['A', false], ['L', true]]);
});
```

- [ ] **Step 2: Write the failing menu-model test** (`canvas-context-menu.test.tsx`, TC-038 menu half)

```ts
const ids = (entries: MenuEntry[]): unknown[] => entries.map((e) => (e.kind === 'item' ? e.action : e.kind === 'separator' ? '|' : ['Align', ids(e.items)]));
it('builds the v2 menus with predicate filtering and collapsed separators (FR-014 UX, F-29)', () => {
  expect(ids(menuEntries({ kind: 'node', id: 'n' }, { canEdit: true, movableSelected: 1 }))).toEqual(['copy', 'cut', 'paste', 'duplicate', '|', 'zoomToSelection', '|', 'delete']);
  expect(ids(menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 2 }))).toEqual(['copy', 'cut', 'paste', 'duplicate', '|', ['Align', ['alignLeft', 'alignCenterH', 'alignRight', 'alignTop', 'alignMiddleV', 'alignBottom']], 'zoomToSelection', '|', 'delete']);
  expect(ids(menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 3 }))[5]).toEqual(['Align', ['alignLeft', 'alignCenterH', 'alignRight', 'alignTop', 'alignMiddleV', 'alignBottom', '|', 'distributeH', 'distributeV']]);
  expect(ids(menuEntries({ kind: 'edge', id: 'e' }, { canEdit: true, movableSelected: 0 }))).toEqual(['delete']);
  expect(ids(menuEntries({ kind: 'pane' }, { canEdit: true, movableSelected: 0 }))).toEqual(['paste', 'selectAll', 'fitView', 'zoomToSelection', 'cheatSheet']);
  expect(ids(menuEntries({ kind: 'pane' }, { canEdit: false, movableSelected: 0 }))).toEqual(['fitView', 'zoomToSelection', 'cheatSheet']);
});
it('every item resolves its label, hint and aria string from the registry', () => {
  for (const e of menuEntries({ kind: 'selection' }, { canEdit: true, movableSelected: 3 })) if (e.kind === 'item') expect(bindingFor(e.action).label).toBeTruthy();
  expect(formatKeys('alignLeft', 'mac')).toBe('⌘⇧←'); expect(formatKeys('alignLeft', 'other')).toBe('Ctrl+Shift+←'); expect(formatKeys('distributeH', 'other')).toBe('');
  expect(ariaKeyShortcuts('alignLeft')).toBe('Control+Shift+ArrowLeft Meta+Shift+ArrowLeft');
});
```

Also `registry.test.ts`: `expect(matchShortcut(key('ArrowLeft', { ctrlKey: true, shiftKey: true }))).toBe('alignLeft'); expect(matchShortcut(key('ArrowLeft', { shiftKey: true }))).toBeNull();` and `useCanvasActions.test.tsx`: `align('left')` with two selected nodes at x 0 / 300 → `moveNodes` called once with `[{ id: 'Y', position: { x: 0, y: 0 } }]`; with one selected → not called; `useKeyboardShortcuts.test.tsx`: `press(nodeEl, 'ArrowLeft', { ctrlKey: true, shiftKey: true })` on a focused `.react-flow__node` whose own listener preventDefaults → `actions.align` called with `'left'`, node listener not called (TC-031 second half).

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/unit/canvas/align.test.ts tests/unit/components/canvas/canvas-context-menu.test.tsx tests/unit/canvas/registry.test.ts` → FAIL.

- [ ] **Step 4: Implement** `align.ts`, `useArrange.ts`, the two actions (+ `runAction` cases: `alignLeft` → `actions.align('left')` …, `distributeH` → `actions.distribute('h')`), registry bindings + row, `menuEntries` + the rendered menu (map entries to `ContextMenuItem` / `ContextMenuSeparator` / `ContextMenuSub`; keep the v1 capture-phase target resolution untouched), `SelectionToolbar`, and the `canvas-editor.tsx` mount.

- [ ] **Step 5: Run to verify pass** — Step 3 command plus `tests/unit/hooks tests/unit/components tests/unit/canvas/shortcuts.test.ts` → PASS after inserting `'Align'` before `'Zoom to selection'` in the `shortcuts.test.ts:76` list (final trailing rows: Select all · Duplicate · Clear selection · Keyboard shortcuts · Copy / Cut / Paste · Add shape at pointer · Grid · Align · Zoom to selection; the editor cheat-sheet therefore has 19 rows).

- [ ] **Step 6: Quality gate and commit 4**

Run: `npm run check` → green.

```bash
git add lib/canvas/align.ts hooks/useArrange.ts components/canvas/selection-toolbar.tsx components/canvas/canvas-context-menu.tsx components/canvas/canvas-editor.tsx hooks/useCanvasActions.ts lib/canvas/registry.ts lib/canvas/shortcuts.ts tests/unit/canvas/align.test.ts tests/unit/components/canvas/canvas-context-menu.test.tsx tests/unit/canvas/registry.test.ts tests/unit/hooks/useCanvasActions.test.tsx tests/unit/hooks/useKeyboardShortcuts.test.tsx
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): align and distribute with selection toolbar, context-menu clipboard and align submenu"
```

---
### Task 6: End-to-end specs — single-user and two-user (spec T-014, T-015) — commit 5

**Files:**
- Create: `tests/e2e/productivity.spec.ts`, `tests/e2e/productivity-collab.spec.ts` (flat, like `ergonomics*.spec.ts`)
- Modify: `tests/e2e/ergonomics.spec.ts:57` (AC-001 labels → `['Zoom out', 'Zoom 100 %, reset to 100 %', 'Zoom in', 'Fit view', 'Grid', 'Undo', 'Redo']`), `:181` (cheat-sheet rows: header + 19 editor rows → `toHaveCount(20)`), `:308` (node menu text → `['CopyCtrl+C', 'CutCtrl+X', 'PasteCtrl+V', 'DuplicateCtrl+D', 'Zoom to selectionShift+2', 'DeleteDel']` for a single selected node); viewer cheat-sheet count if asserted (4 → 6 rows)
- Modify: `tests/e2e/helpers/canvas.ts` (add `addNodeAt(page, shape, position)` → `window.__canvasMutations!.addNode(shape, position)` returning the id, and `nodePosition(page, id)`)
- Modify: `features/10-canvas-ergonomics-and-keyboard/status.md` (Evidence: v2 commits, check/build/e2e output, AC map, AC-042 observation, AC-043 pending owner) — the only documentation file this phase touches without further authorisation; `context/ui-context.md`, `context/data-ownership.md`, `decision-log.md` D-10f–D-10k copies wait for the owner (04-plan §Order)

**Interfaces:**
- Consumes: `openCanvas`, `dropShape`, `addShape`, `getViewport`, `setViewport` (`tests/e2e/helpers/canvas.ts`); `createProjectFor`, `addMember`, `deleteProject`, `deleteRoom`; the two-user fixture (`tests/e2e/fixtures/two-users.ts`); test hooks `window.__rf`, `__canvasMutations`, `__history`, `__clipboard`, `__rfStore`; the v1 helpers copied from `ergonomics*.spec.ts` (`closeProjectSidebar`, `controls`, `control`, `nodeIds`, `edgeIds`, `position`, `sameOnBoth`, `settle`, `addEdge`).
- Produces: nothing downstream.

Both specs `test.use({ actionTimeout: 15_000 })`, `test.setTimeout(150_000)` per test, clean up project + room in `afterEach`. Clipboard tests grant `['clipboard-read', 'clipboard-write']` on each context (`a.context().grantPermissions(…)`) before the first copy. Keys: `Control+c`, `Control+x`, `Control+v`, `Control+Quote`, `Shift+Digit2`, `Control+Shift+ArrowLeft`.

- [ ] **Step 1: Write `tests/e2e/productivity.spec.ts`** (TC-039–TC-042; four tests, ids below are the assertion checklist each must contain)

```ts
test('grid: Ctrl+\' and the toggle snap drags to 20 px, persist across reload, and never touch undo (AC-034)', …)
  // open; const id = await addNodeAt(page, 'rectangle', { x: 33, y: 47 }); read control(page,'Undo') disabled state before the toggle and assert it is identical after it
  // press Control+Quote → expect(control(page,'Grid')).toHaveAttribute('aria-pressed','true'); __rfStore: snapToGrid === true && snapGrid deep-equals [20,20]
  // background: expect(page.locator('.react-flow__background pattern path')).toHaveCount(≥1) (lines) — dots render <circle>
  // drag node by (+10,+10) with mouse.move/down/move(steps 6)/up from its centre → nodePosition(page,id): x % 20 === 0 && y % 20 === 0
  // reload via openCanvas(page, projectId) → Grid still aria-pressed=true; click Grid → false, snapToGrid false, pattern circle present; drag (+7,+7) → position not multiple of 20
test('Shift+2 fits the selection, equals Shift+1 with nothing selected, and works from the pane menu (AC-039)', …)
  // 5 nodes via addNodeAt at (0,0) (200,0) (400,0) (5000,5000) (5200,5000); select the two far ones (click + Control-click); press Shift+Digit2
  // within 300 ms: both selected node boxes fully inside page.viewportSize(); at least one of the first three nodes has no intersection with the viewport
  // clickEmpty → Shift+Digit2 → vpA; Shift+Digit1 → vpB → expect(vpA).toEqual(vpB) within 1e-3 per field; right-click pane → menuitem 'Zoom to selection' → same viewport as vpA (after clearing selection)
test('zoom readout, reset and limit buttons (AC-040)', …)
  // readout = controls(page).locator('[data-slot="zoom-readout"]'): '100 %'; control 'Zoom in' click → readout !== '100 %'; readout click → '100 %' and (await getViewport(page)).zoom === 1 within 300 ms
  // __rf.zoomTo(4) → Zoom in disabled, readout '400 %', Zoom out enabled; __rf.zoomTo(0.1) → Zoom out disabled, readout '10 %'
test('undo set: non-content actions never enable Undo; mid-drag Ctrl+Z is ignored (AC-041)', …)
  // addNodeAt ×2, then openCanvas again (fresh history) → Undo disabled; click node; box-select by dragging on empty pane; press '+'; __rf.setViewport({x:50,y:50,zoom:1}); Control+Quote; '?' then Escape → Undo still disabled throughout
  // addShape(page,'circle') → Undo enabled; mouse.down on it, move 40 px (steps 4), press Control+z while down → node count unchanged and __history.canUndo() still true; mouse.up → position moved by ≈ 40 px
```

- [ ] **Step 2: Write `tests/e2e/productivity-collab.spec.ts`** (TC-043–TC-046; uses the two-user fixture; B is an EDITOR)

```ts
test('cut copies the selection and deletes it in one undo step on both clients (AC-028, EC-020)', …)
  // X, Y, Z via dropShape on A; edges E (X→Y), F (X→Z) via addEdge; sameOnBoth
  // A selects X, Y (click + Control-click) → Control+x → sameOnBoth([z], []) within 1 s; __clipboard.text parses: 2 nodes, keys exactly [data,height,id,position,type,width], 1 edge (E)
  // settle(a); A clicks Undo → sameOnBoth([x,y,z],[E,F]); __clipboard.text unchanged; A pastes (Control+v) → 5 nodes / 3 edges, pasted ids ∉ {x,y,z}
test('paste lands at the pointer, at the viewport centre when off-canvas, and in a second tab of the same user (AC-032, EC-019)', …)
  // A: X, Y + E; select both; Control+c; mouse.move(600,400); Control+v → both clients 4 nodes / 2 edges within 1 s
  // copies = nodes not in {x,y}: bbox centre (position + width/height) within 2 px of __rf.screenToFlowPosition({x:600,y:400}); A's selection === the copies (nodes and edge); one Undo → back to 2/1
  // open the project sidebar (button 'Open projects sidebar'), hover it (mouse.move inside its box), Control+v → copies' bbox centre within 2 px of screenToFlowPosition(container centre)
  // second tab: const t = await a.context().newPage(); openCanvas(t, projectId2 /* second project of user A */); t.mouse.move(640,400); t.keyboard.press('Control+v') → 2 nodes / 1 edge in project 2 with fresh ids
test('Ctrl+Shift+ArrowLeft aligns three nodes with one focused, the toolbar and submenu align/distribute, one undo each (AC-037, AC-038, EC-027)', …)
  // P, Q, R = addNodeAt(a, 'rectangle', …) at (0,0), (50,120), (400,240); rectangles are 180 wide, so the AC-038 formula gives the same middle x: span 0..580, Σwidth 540, gap 20 → Q.x = 180 + 20 = 200
  // select all three (Control+a), focus P (node(a,P).focus()), Control+Shift+ArrowLeft → all x equal on both within 1 s; every y unchanged (no nudge); A Undo → original x
  // toolbar = a.getByRole('toolbar', { name: 'Arrange selection' }): 8 buttons; four edge buttons carry aria-keyshortcuts; click 'Align centre (horizontal)' → equal x-centres on both; Undo
  // right-click a selected node → hover 'Align' → 'Distribute horizontally' → middle node x === 200 on both; Undo → x 50
  // select only P → toolbar count 0; right-click P → menu has no 'Align'
test('a remote change does not clear the local redo stack (AC-042 — UNVERIFIED Liveblocks behaviour; see Step 5)', …)
  // A: addShape → Undo (button) → Redo enabled; B drags another node (or __canvasMutations.moveNodes on B); A: control 'Redo' still enabled; A presses Control+Shift+z → the node is back on both
```

- [ ] **Step 3: Update the three v1 assertions in `tests/e2e/ergonomics.spec.ts`** listed in Files, add the two helpers to `tests/e2e/helpers/canvas.ts`.

- [ ] **Step 4: Run the F10 e2e set**

Run: `E2E_PORT=<worktree port> E2E_LIVEBLOCKS=1 npx playwright test tests/e2e/productivity.spec.ts tests/e2e/productivity-collab.spec.ts tests/e2e/ergonomics.spec.ts tests/e2e/ergonomics-collab.spec.ts`
Expected: all pass. Known v1 flakes (page-load timeout under load) may be re-run once alone; record any re-run.

- [ ] **Step 5: AC-042 outcome.** If the redo test fails because Liveblocks cleared the redo stack on the remote change: do not weaken the assertion and do not add a workaround. Record the observed behaviour in `status.md` ("AC-042 unmet — Liveblocks 3.24.4 clears redo on remote change; evidence: run log"), keep the test (it documents the expected behaviour) and report it as an owner decision (accept the limitation vs. open an upstream question).

- [ ] **Step 6: Manual AC-043** — leave as "pending owner" in `status.md` with the four screenshot prompts (grid on `bg-base`, readout width at 10 %/100 %/400 %, 3-node selection with both toolbars, Align submenu via keyboard).

- [ ] **Step 7: Commit 5 happens after Task 7's verification** (Task 7 Step 4).

---

### Task 7: Final verification, status evidence and commit 5

**Files:**
- Modify: `features/10-canvas-ergonomics-and-keyboard/status.md` (Evidence section only; status line → "v2 Verification" — the owner moves it to Completed)

- [ ] **Step 1: Full quality gate** — Run: `npm run check` → typecheck, lint, all unit tests, `prisma validate` green. Save the log to a scratch file and quote the vitest summary line.

- [ ] **Step 2: Production build** — Run: `npm run build` → completes; no Cache Components violations; `/editor/[id]` unchanged in the route table.

- [ ] **Step 3: Full e2e** — Run: `E2E_PORT=<port> E2E_LIVEBLOCKS=1 npm run e2e` → all specs pass (perf is ignored locally by config). Record totals and any single re-run.

- [ ] **Step 4: Audit** — Run and expect zero hits:
  - `rg -n "fitView\(" --glob '!hooks/useCanvasActions.ts' --glob '!components/canvas/flow-canvas.tsx' --glob '!tests/**' components hooks lib` (F06 FR-009 allowlist: only the actions hook and the one-time `onInit` fit)
  - `rg -n "'mod\+|Ctrl\+|⌘" components hooks --glob '!**/registry.ts'` → nothing except strings that come from `formatKeys` (manual read of hits; no literal chord copy)
  - `rg -n "NODE_KINDS|addNodeOfKind|TEXT_MAX_LENGTH" lib hooks components --glob '!lib/canvas/kinds.ts'` → zero (F22 isolation)
  - `rg -n "Co-Authored-By|Claude|Anthropic" <(git log -5 --format=%B)` → zero; `git log -4 --format='%an <%ae> %cn <%ce>'` → every line `krishna <krishnagtkr@gmail.com>`
  - `git status` → only the files in this plan's Files lists are staged for commit 5; `No_touch_ai/`, `AGENTS.md`, `.gitignore` untouched by this branch
- [ ] **Step 5: Write the Evidence** in `status.md`: five commit hashes + messages, the four command summaries, AC map (unit: 025, 026, 027, 029, 030, 031, 033, 035, 036, 041-unit; e2e: 028, 032, 034, 037, 038, 039, 040, 041, 042-observed; manual: 043 pending), spec-gap list from this plan, and the owner decisions still open (AC-042 outcome, documentation updates to `ui-context.md`/`data-ownership.md`/`decision-log.md`).

- [ ] **Step 6: Commit 5**

```bash
git add tests/e2e/productivity.spec.ts tests/e2e/productivity-collab.spec.ts tests/e2e/ergonomics.spec.ts tests/e2e/helpers/canvas.ts features/10-canvas-ergonomics-and-keyboard/status.md
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "test(canvas): F10 v2 productivity e2e, single-user and two-user; status evidence"
```

Then stop: report per `CLAUDE.md` §9 (Phase / Changed / Verification / Acceptance / Git / Blockers / Next step). No push, no merge, no documentation beyond `status.md`.

---

## Spec gaps found while planning (report to the owner; none blocks implementation)

1. **`onPaneMouseMove` is dead for editors.** `@xyflow/react` 12.12.0 `index.js` L1647 passes `onPaneMouseMove` only when `!isSelectionEnabled`, and L2115–2124 make `isSelecting` true whenever `selectionOnDrag` is set (it is, F06). The design's pointer source (02-design v2 "Pointer") would never fire; this plan tracks the pointer with native `pointermove`/`pointerleave` listeners on the flow container instead (Task 3). The verified-facts row stays true (the props exist) but should gain this caveat.
2. **AC-025 "every `ShortcutAction` has ≥ 1 chord" contradicts FR-021/FR-024 and the UX list:** `resetZoom`, `alignCenterH`, `alignMiddleV`, `distributeH`, `distributeV` have no default key by design. The plan introduces `KEYLESS` and asserts "≥ 1 chord unless keyless" (Task 1).
3. **Test-file paths.** The spec names `tests/e2e/canvas/10-productivity*.spec.ts`, `tests/unit/components/canvas/canvas-controls.test.tsx (extended)` and `canvas-context-menu.test.tsx (v1 AC-016 enumeration updated)`; the repo has flat `tests/e2e/*.spec.ts`, no control-bar unit test and no menu unit test (v1 AC-016 is asserted in `ergonomics.spec.ts:308`). The plan follows the repo layout and creates the two unit files new.
4. **`paste(text?)` is split** into sync `paste(text): boolean` and async `pasteFromClipboard()`, because the `paste` event must decide `preventDefault()` synchronously (D-10f) — the design's single optional-argument signature cannot.
5. **A malformed envelope** (`type === 'drawarc-clipboard'` but failing Zod/caps) is treated as `none`, not `text` — otherwise a 1 MB broken envelope would become a text node under F22. EC-016's "(plain text → FR-018)" applies only to non-envelope text.
6. **Cheat-sheet Align row** shows the four derived chords rather than the spec's hand-written `⌘/Ctrl+Shift+Arrow`, so FR-014's "no hard-coded chord" holds in `shortcuts.ts` too.
7. **`useGrid()` lives in `hooks/useGrid.ts`**, not `lib/canvas/preferences.ts`, per `code-standards.md` "no React in `lib/`".
8. **AC-034 says "on both clients"** but is a single-user spec; snapping is asserted on one client (positions sync through the same v1 path already covered by AC-005).
9. **D-10j ordering rule for F22:** this branch leaves `t`/`n` in `RESERVED_CHORDS`. When F22 lands second it registers `addText`/`addSticky` by (a) removing `t`/`n` from `RESERVED_CHORDS`, (b) adding bindings `insertText ['t']` / `insertSticky ['n']` (`group: 'insert'`, `mutating: true`), (c) adding the two `ShortcutAction` members, `CanvasActions` methods and `runAction` cases, (d) adding the labels to the "Add shape at pointer" row or a new row. The duplicate test fails the build if (a) is skipped — that is the intended hand-over check.

## Self-review record

- Spec coverage: FR-014 → T1/T3/T4/T5; FR-015 → T3; FR-016/017 → T2/T3/T6; FR-018 → T2/T3; FR-019 → T4/T6; FR-020/021/022 → T5/T6; FR-023/024 → T4/T6; FR-025 → T3 (guard), T6 (AC-041/042). EC-014–EC-027 each named in a test above. AC-043 manual, owner.
- Type consistency checked: `PointerRef`, `runAction`, `paste(text): boolean`, `pasteFromClipboard`, `insertShape`, `align(mode)`, `distribute(axis)`, `moveNodes`, `gridStore`, `useGrid`, `KEYLESS`, `bindingFor`, `menuEntries`, `selectedBoxes` are used with the same names and shapes in every task.
- Proportion: the v2 spec is ~450 lines across seven files; this plan is of similar length and carries signatures, vectors and commands, not bodies.
