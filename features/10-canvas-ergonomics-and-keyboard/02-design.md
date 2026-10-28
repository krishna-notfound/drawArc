# F10 — Design

## Architecture and components

Client-only. All components are children of the F06 island (inside `<ReactFlowProvider>` and the Liveblocks `RoomProvider`).

```
components/canvas/canvas-controls.tsx (new)         ─ pill: zoom −/fit/+ · undo/redo; useReactFlow, useUndo/useRedo/useCanUndo/useCanRedo
components/canvas/canvas-context-menu.tsx (new)     ─ Radix ContextMenu wrapper around the flow container; menu content by target kind
components/canvas/shortcut-cheat-sheet.tsx (new)    ─ shadcn Dialog; rows from lib/canvas/shortcuts.ts
components/ui/context-menu.tsx (generated)          ─ npx shadcn add context-menu (not edited)
hooks/useKeyboardShortcuts.ts (new)                 ─ window keydown; action dispatch
hooks/useCanvasActions.ts (new)                     ─ deleteSelection, duplicateSelection, selectAll, clearSelection, zoomIn/Out, fitView, undo, redo, openCheatSheet (useCallback; shared by bar, keys, menu)
lib/canvas/shortcuts.ts (new)                       ─ SHORTCUTS table (action id, label, keys per platform, viewerVisible), isEditableTarget(), matchShortcut(event)
lib/canvas/duplicate.ts (new)                       ─ pure duplicateSelection(nodes, edges) → { nodes, edges, idMap }
components/canvas/flow-canvas.tsx (F06, modified) ─ renders <CanvasControls/>, <CanvasContextMenu>…</CanvasContextMenu>, <ShortcutCheatSheet/>; passes onNodeContextMenu/onEdgeContextMenu/onPaneContextMenu; asserts selection props
```

### Action layer (`useCanvasActions`)

```ts
const store = useStoreApi();                // React Flow store (event-time reads)
const rf = useReactFlow();
const m = useCanvasMutations();             // F07
const undo = useUndo(), redo = useRedo();   // @liveblocks/react/suspense
const room = useRoom();

deleteSelection(): { const { nodes, edges } = store.getState();
  const n = nodes.filter(x => x.selected), e = edges.filter(x => x.selected);
  if (!m.canEdit || (n.length === 0 && e.length === 0)) return;
  m.onDelete({ nodes: n, edges: e }); }                                   // one Liveblocks step; node edges cascade (F09)
duplicateSelection(): { …; const { nodes: dn, edges: de } = duplicateSelection(selNodes, allEdges);
  room.batch(() => { m.addNodes(dn); de.forEach(m.addEdge); });          // one message, one undo step (liveblocks.md §2)
  selectOnly([...dn.map(x => x.id)], de.map(x => x.id)); }
selectAll(): store.getState().addSelectedNodes(allNodeIds) + addSelectedEdges(allEdgeIds)   // UNVERIFIED action names; fallback: emit select changes via onNodesChange/onEdgesChange (local-only)
clearSelection(): store.getState().unselectNodesAndEdges()                                   // same caveat
zoomIn/zoomOut/fitView: rf.zoomIn({ duration: 200 }) …
```

Why `getState()` at event time (D-10a): React Flow's performance guide warns against reading `nodes`/`edges` arrays in components; a subscription would re-render the host of the key handler on every drag frame. Event-time reads are free.

### Keyboard (`useKeyboardShortcuts`)

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target) || e.isComposing || hasOpenDialog()) return;
    const action = matchShortcut(e, platform);            // returns ShortcutAction | null
    if (!action) return;
    if (!canEdit && MUTATING.has(action)) return;         // viewer: no preventDefault either
    e.preventDefault(); dispatch(action);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [dispatch, canEdit, platform]);
```

`matchShortcut` table (keys normalised with `e.key.toLowerCase()`, `mod = e.metaKey || e.ctrlKey`):

| Action | Match |
|---|---|
| `undo` | `mod && !shift && key === 'z'` |
| `redo` | `(mod && shift && key === 'z') \|\| (mod && key === 'y')` |
| `zoomIn` | `!mod && !alt && (key === '+' \|\| key === '=')` |
| `zoomOut` | `!mod && !alt && key === '-'` |
| `fitView` | `shift && !mod && code === 'Digit1'` |
| `clearSelection` | `key === 'Escape'` and `document.activeElement` is not inside `.react-flow__node`/`.react-flow__edge` (React Flow's own Esc handles the focused case) |
| `selectAll` | `mod && key === 'a'` |
| `duplicate` | `mod && key === 'd'` |
| `delete` | `key === 'Delete' \|\| key === 'Backspace'` (no modifiers) |
| `cheatSheet` | `key === '?'` |

`isEditableTarget(t)`: `t instanceof Element && (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"]') !== null)`. `hasOpenDialog()`: `document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null` (shadcn/Radix attributes).

### Context menu

`<ContextMenu>` (Radix) wraps the flow container as `<ContextMenuTrigger asChild>`. React Flow's `onNodeContextMenu(e, node)`, `onEdgeContextMenu(e, edge)`, `onPaneContextMenu(e)` run during the same `contextmenu` event and set `target = { kind: 'node' | 'edge' | 'pane', id? }` **before** Radix opens (React handlers on descendants fire before the trigger's listener because the pane is a descendant of the trigger). Right-drag suppression: a capture-phase `pointerdown` on the container records the start point; a capture-phase `contextmenu` listener calls `stopPropagation()` + `preventDefault()` if the pointer moved > 4 px since (Radix never sees it). If the target node/edge is not in the selection, the menu first selects it (`selectOnly`). Menu content per kind (FR-009); item `onSelect` dispatches the same actions as the keyboard. Target cleared on close and when a store subscription (narrow: existence of `target.id`) reports the element gone (EC-013).

### Cheat-sheet

`lib/canvas/shortcuts.ts` exports `SHORTCUT_ROWS: { action: string; input: string; viewerVisible: boolean }[]`; the first ten rows are string-identical to the ui-context table (a unit test loads `context/ui-context.md`, parses the "Interaction conventions" table, and asserts equality — the context file is the source of truth). The dialog renders the rows filtered by role.

## Domain model and TypeScript contracts

No schema change. Contracts:

```ts
// lib/canvas/duplicate.ts
export function duplicateSelection(selected: CanvasNode[], edges: CanvasEdge[], offset = { x: 20, y: 20 }):
  { nodes: CanvasNode[]; edges: CanvasEdge[]; idMap: Map<string, string> }
// nodes: new id via newNodeId(data.shape), position + offset, same width/height, data cloned; selected/dragging/measured/resizing stripped
// edges: only those with source AND target in selected; new id via newEdgeId(); endpoints via idMap; data cloned

// lib/canvas/shortcuts.ts
export type ShortcutAction = 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'fitView' | 'clearSelection' | 'selectAll' | 'duplicate' | 'delete' | 'cheatSheet';
export const MUTATING: ReadonlySet<ShortcutAction>;   // undo, redo, duplicate, delete
export function matchShortcut(e: KeyboardEvent, platform: 'mac' | 'other'): ShortcutAction | null;
export function isEditableTarget(t: EventTarget | null): boolean;
export function formatKeys(action: ShortcutAction, platform: 'mac' | 'other'): string;   // "⌘Z" | "Ctrl+Z"

// hooks/useCanvasActions.ts
export interface CanvasActions { deleteSelection(): void; duplicateSelection(): void; selectAll(): void; clearSelection(): void;
  zoomIn(): void; zoomOut(): void; fitView(): void; undo(): void; redo(): void; openCheatSheet(): void; canEdit: boolean; canUndo: boolean; canRedo: boolean }

// components/canvas/canvas-context-menu.tsx
type ContextTarget = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | { kind: 'pane' };
```

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Node/edge removal, duplicates | Liveblocks Storage via F06 hook (`onDelete`, `add` changes) | Through `useCanvasMutations` only. |
| Undo/redo stacks | Client memory (Liveblocks history per connection) | Per data-ownership table; cleared on reload. |
| Selection, viewport | React Flow store (client) | Never synced. |
| Context-menu target, cheat-sheet open | Component state | Ephemeral. |

## API and integration contracts

None (no routes/actions/events). Liveblocks: `useUndo/useRedo/useCanUndo/useCanRedo`, `useRoom().batch`.

## Security and validation

- Viewers: UI absent/no-op; `*:read` token rejects writes (F05). No new inputs cross a server boundary.
- Duplicate copies only `data` keys from schema v1; no user-controlled strings beyond existing labels.
- `?` and other single-key shortcuts are suppressed in editable targets so no keystroke is lost from a form.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `deleteKeyCode` default `'Backspace'`, `KeyCode \| null` (`null` disables); `selectionKeyCode 'Shift'`, `multiSelectionKeyCode 'Meta'/'Control'`, `panActivationKeyCode 'Space'`, `selectionOnDrag`, `selectionMode`, `panOnDrag` button array | https://reactflow.dev/api-reference/react-flow , https://reactflow.dev/learn/concepts/the-viewport | checked 2026-10-22 |
| `SelectionMode.Partial` selects on partial overlap | https://reactflow.dev/api-reference/types/selection-mode | checked 2026-10-22 |
| Built-in a11y keys: Enter/Space select, Escape clears, arrows nudge (Shift faster); Backspace deletes only via `deleteKeyCode` | https://reactflow.dev/learn/advanced-use/accessibility | checked 2026-10-22 |
| Undo/redo, copy/paste, duplicate, select-all are not built in | https://reactflow.dev/examples/interaction/undo-redo , https://reactflow.dev/examples/interaction/copy-paste | checked 2026-10-22 |
| `zoomIn/zoomOut/fitView` accept `{ duration }`; `fitView` accepts `padding`; viewport methods return `Promise<boolean>` | https://reactflow.dev/api-reference/types/react-flow-instance | checked 2026-10-22 |
| `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu` props exist; the example's handler code is UNVERIFIED (not fetched) | https://reactflow.dev/api-reference/react-flow , https://reactflow.dev/examples/interaction/context-menu | checked 2026-10-22 |
| Do not derive selection by filtering `nodes` in components; use store selectors / event-time reads | https://reactflow.dev/learn/advanced-use/performance | checked 2026-10-22 |
| `useUndo/useRedo/useCanUndo/useCanRedo`; undo affects only the current client; history in-memory, reset on reload | https://liveblocks.io/docs/api-reference/liveblocks-react | checked 2026-10-22 |
| Undo "applies the inverse of your original change as a new change without rebasing, so it can overwrite someone's newer value" | https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync | checked 2026-10-22 |
| `room.batch()` = one message + one undo step; `@liveblocks/react-flow`: `onDelete` removes node + edges atomically | https://liveblocks.io/docs/api-reference/liveblocks-client , https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| **UNVERIFIED**: React Flow store action names `addSelectedNodes`, `addSelectedEdges`, `unselectNodesAndEdges` — confirm in T-002; fallback emits local `select` changes. | — | — |
| **UNVERIFIED**: Liveblocks clears the redo stack on a new local change (standard behaviour, not stated on fetched pages) — asserted by AC-022. | — | — |
| **UNVERIFIED**: Radix ContextMenu opening when React Flow handlers run on the same event and our capture-phase suppression — T-005 prototype. | — | — |

## v2 — canvas productivity (2026-10-28)

### Architecture and components (v2)

Client-only, still under `ReactFlowProvider` + `RoomProvider`. No route, action, event or schema change; nothing new crosses a server boundary.

```
lib/canvas/registry.ts (new)                 ─ SHORTCUTS bindings + RESERVED_CHORDS; normaliseChord(event) → chord string; derive matchShortcut/formatKeys/ariaKeyShortcuts
lib/canvas/shortcuts.ts (modified)           ─ keeps every v1 export (re-implemented over the registry); SHORTCUT_ROWS = 10 verbatim rows + rows generated from the registry
lib/canvas/clipboard.ts (new)                ─ envelope type + Zod schema, serializeSelection, parseClipboardText, placePasted, memory fallback, write/read helpers
lib/canvas/align.ts (new)                    ─ pure alignNodes(nodes, mode) / distributeNodes(nodes, axis) → { id, position }[]
lib/canvas/preferences.ts (new)              ─ grid flag: localStorage-backed external store (subscribe/get/set), SSR-safe
lib/canvas/kinds.ts (new, 5 lines)           ─ `canvasKinds()`: F22's NODE_KINDS when exported, else NODE_SHAPES (D-10j); the only F22-aware import
hooks/useCanvasMutations.ts (F07, modified)  ─ + moveNodes(moves: { id; position }[]): one replace change set
hooks/useCanvasActions.ts (modified)         ─ + copy, cut, paste(text?), insertShape(shape), align(mode), distribute(axis), zoomToSelection, resetZoom, toggleGrid; takes a pointer ref
hooks/useKeyboardShortcuts.ts (modified)     ─ capture-phase keydown (D-10g); + window `paste` listener with the same ignore rules (D-10f)
hooks/usePointerPosition.ts (new)            ─ ref of the last client point over the pane; handlers for <ReactFlow onPaneMouseMove/onPaneMouseLeave> and node mouse move
components/canvas/canvas-controls.tsx (mod.) ─ zoom readout, Grid toggle, min/max disabling, aria-keyshortcuts
components/canvas/canvas-context-menu.tsx    ─ Copy/Cut/Paste, Align submenu (ContextMenuSub), Zoom to selection; predicate filter + separator collapse
components/canvas/selection-toolbar.tsx (new)─ NodeToolbar with align/distribute buttons (≥ 2 / ≥ 3 selected)
components/canvas/shortcut-cheat-sheet.tsx   ─ unchanged component; new rows arrive through SHORTCUT_ROWS
components/canvas/flow-canvas.tsx (F06, mod.)─ snapToGrid/snapGrid/Background variant from the grid store; onPaneMouseMove/Leave wired; <SelectionToolbar/> child
components/canvas/canvas-ergonomics.tsx      ─ owns the pointer ref; passes it to actions
components/canvas/canvas-test-hooks.tsx (mod.)─ + window.__clipboard (memory text, e2e only)
```

### Registry contract

```ts
// lib/canvas/registry.ts
export type ShortcutAction = /* v1 */ 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'fitView' | 'clearSelection' | 'selectAll'
  | 'duplicate' | 'delete' | 'cheatSheet'
  /* v2 */ | 'copy' | 'cut' | 'paste' | 'toggleGrid' | 'zoomToSelection' | 'resetZoom'
  | 'alignLeft' | 'alignRight' | 'alignTop' | 'alignBottom' | 'alignCenterH' | 'alignMiddleV' | 'distributeH' | 'distributeV'
  | 'insertRectangle' | 'insertDiamond' | 'insertCircle' | 'insertPill' | 'insertCylinder' | 'insertHexagon';
/** Chord grammar: `[mod+][shift+][alt+]<key>`; key is `event.key` lower-cased for single chars, the named key otherwise,
 *  or `code:<event.code>` for layout-independent matches (`code:Digit1`, `code:Digit2`, `code:Quote`). */
export interface ShortcutBinding {
  action: ShortcutAction; chords: readonly string[]; label: string;
  group: 'navigate' | 'select' | 'edit' | 'insert' | 'arrange' | 'history' | 'help';
  mutating: boolean; viewerVisible: boolean;
  /** 'keydown' (default) or 'paste-event' (D-10f); 'capture' chords also stopPropagation (D-10g, align keys). */
  handledBy?: 'keydown' | 'paste-event';
}
export const SHORTCUTS: readonly ShortcutBinding[];
export const RESERVED_CHORDS: Readonly<Record<string, string>>;   // { t: 'F22 text', n: 'F22 sticky', f: 'F23 frame', x: 'F21 freehand', i: 'F24 image' }
export function normaliseChord(e: KeyEventLike): string | null;    // null when altKey-only combos etc.
export function matchShortcut(e: KeyEventLike): ShortcutAction | null;   // lookup by normaliseChord; letters require no modifier
export function formatKeys(action: ShortcutAction, platform: Platform): string;   // first chord, platform glyphs
export function ariaKeyShortcuts(action: ShortcutAction): string;  // "Control+Shift+z Meta+Shift+z"
export const MUTATING: ReadonlySet<ShortcutAction>;                // derived from bindings
```

Duplicate test (FR-014): flatten `SHORTCUTS[].chords` + `Object.keys(RESERVED_CHORDS)`; assert `new Set(all).size === all.length`, and that every v1 `formatKeys` string is unchanged (snapshot of the ten v1 actions). `ui-context.md` is not edited by this increment; the ten verbatim rows remain the copy test's source (AC-019).

### Clipboard contract (D-10f)

```ts
// lib/canvas/clipboard.ts
export const CLIPBOARD_TYPE = 'drawarc-clipboard';
export const CLIPBOARD_MAX_CHARS = 1_000_000; export const CLIPBOARD_MAX_NODES = 500; export const CLIPBOARD_MAX_EDGES = 1_000;
export const ClipboardEnvelopeSchema = z.object({ type: z.literal(CLIPBOARD_TYPE), schemaVersion: z.number().int().min(1).max(CANVAS_SCHEMA_VERSION),
  nodes: z.array(PersistedNodeSchema).max(CLIPBOARD_MAX_NODES), edges: z.array(PersistedEdgeSchema).max(CLIPBOARD_MAX_EDGES) }).strict();
export type ClipboardEnvelope = z.infer<typeof ClipboardEnvelopeSchema>;
export function serializeSelection(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): ClipboardEnvelope; // toDocument rules; edges with both ends selected
export function parseClipboardText(text: string): { kind: 'envelope'; envelope: ClipboardEnvelope } | { kind: 'text'; text: string } | { kind: 'none' };
// 'envelope' only when JSON.parse succeeds AND type === CLIPBOARD_TYPE AND Zod passes (older schemaVersion run through `migrate` first); 'text' for any other non-empty text; 'none' over the cap
export function placePasted(env: ClipboardEnvelope, centre: XYPosition): { nodes: CanvasNode[]; edges: CanvasEdge[] };
// new ids (newNodeId(kind)/newEdgeId), endpoint remap, dangling edges dropped, translation = centre − bbox centre (bbox from position+width/height)
export const memoryClipboard: { text: string | null };
export async function writeClipboardText(text: string): Promise<void>;   // memory first, then navigator.clipboard?.writeText (errors swallowed)
export async function readClipboardText(): Promise<string | null>;        // navigator.clipboard?.readText → catch → memoryClipboard.text
```

Flow: keydown `mod+C` → `actions.copy()` (preventDefault). Keydown `mod+V` is **not** matched; the window `paste` listener (same ignore rules; skips `defaultPrevented`) reads `event.clipboardData.getData('text/plain')`, calls `event.preventDefault()` only when the text is an envelope (or a text node will be created), then `actions.paste(text)`. Menu Paste → `actions.paste()` → `readClipboardText()`. `actions.paste` = `parseClipboardText` → `placePasted(env, pointer ?? viewportCentre)` → `room.batch(() => { addNodes; addEdge… })` → `selectOnly`. Pointer: `usePointerPosition` stores the last `clientX/Y` from `onPaneMouseMove` and node `onMouseMove`-equivalent (`onNodeMouseMove`), cleared on `onPaneMouseLeave`; converted at paste time with `screenToFlowPosition`. Viewport centre = container rect centre → `screenToFlowPosition` (F07 FR-007 helper reused).

### Align / distribute contract (D-10k)

```ts
// lib/canvas/align.ts
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'middleV';
export type Axis = 'h' | 'v';
export interface NodeBox { id: string; x: number; y: number; width: number; height: number; locked?: boolean }
export function alignNodes(boxes: readonly NodeBox[], mode: AlignMode): { id: string; position: XYPosition }[];   // only boxes that move; [] if < 2 movable
export function distributeNodes(boxes: readonly NodeBox[], axis: Axis): { id: string; position: XYPosition }[];   // sort by x (or y); first/last fixed; equal gaps; [] if < 3 movable
```
`useCanvasActions.align(mode)` builds boxes from `store.getState().nodes` (selected, `width/height` from the stored node, `locked` from `data` when present), calls the helper, and if non-empty `mutations.moveNodes(result)` → one `triggerNodeChanges([{ type: 'replace', … }])` (the F08 FR-012 pattern: one `onNodesChange` call = one Liveblocks batch = one undo entry).

### Grid preference

`lib/canvas/preferences.ts`: `gridStore = { subscribe(cb), get(): boolean, set(v) }` over `localStorage['drawarc.grid']` (`'1'`/absent), reads wrapped in try/catch (EC-023), server snapshot `false`; `useGrid()` = `useSyncExternalStore(subscribe, get, () => false)`. `flow-canvas.tsx` reads it for `snapToGrid`, `snapGrid={SNAP_GRID}` (`const SNAP_GRID: SnapGrid = [20, 20]`, stable) and `<Background variant={grid ? BackgroundVariant.Lines : BackgroundVariant.Dots} gap={20} color="var(--border-default)">`. Keydown `mod+'` and the bar toggle call `gridStore.set(!get())`.

### Zoom readout and limits

`useStore((s) => s.transform[2])` for the label; `useStore((s) => s.transform[2] >= s.maxZoom - 1e-6)` / `<= s.minZoom + 1e-6` for disabling. Reset → `rf.zoomTo(1, { duration: 200 })`. Zoom to selection → `rf.fitView({ nodes: selected.map(n => ({ id: n.id })), duration: 200, padding: 0.2 })`, falling back to `fitView(FIT)` with no selection. `fitView` remains called only from `hooks/useCanvasActions.ts` (F06 FR-009 grep allowlist unchanged).

### Data and state ownership (v2 rows)

| State | Owner | Notes |
|---|---|---|
| Clipboard envelope | OS clipboard (text) + in-memory module variable | Never Storage; never a server. |
| Grid preference | `localStorage` (per browser profile) | Not synced, not undoable; first client-side preference in drawArc — recorded in `context/data-ownership.md` on approval. |
| Last pointer position | Ref in `CanvasErgonomics` | Ephemeral. |
| Aligned/pasted/inserted nodes | Liveblocks Storage via `useCanvasMutations` | Same single write path as v1. |

### Security and validation (v2)

- Clipboard text is untrusted input from any application: size cap before parsing, `JSON.parse` in try/catch, strict Zod (unknown keys rejected), ids re-minted client-side so an attacker cannot choose ids; `schemaVersion` newer than the client is rejected. Storage server-side validation (F13) is unchanged and still the authority.
- Viewers: `paste`, `cut`, `insert*`, `align*`, `distribute*` are `mutating` → not handled; `copy` is harmless but empty (no selection for viewers); grid and zoom actions remain.
- `localStorage` holds one boolean; no PII.

### Verified library facts this design relies on (checked 2026-10-28 against `node_modules/@xyflow/react` 12.12.0 types)

| Fact | Source | Status |
|---|---|---|
| `snapToGrid?: boolean`, `snapGrid?: SnapGrid` on `<ReactFlow>`; `SnapGrid = [number, number]` | `dist/esm/types/component-props.d.ts` L319–324; `@xyflow/system` `types/general.d.ts` L179 | VERIFIED |
| `BackgroundVariant.Lines` / `.Dots` / `.Cross`; props `gap`, `color`, `lineWidth`, `offset` | `dist/esm/additional-components/Background/types.d.ts` | VERIFIED |
| `fitView` options include `nodes?: (Node \| { id })[]`, `padding`, `duration`, `minZoom/maxZoom` | `@xyflow/system` `types/general.d.ts` L150–160 | VERIFIED |
| `zoomTo`, `getZoom`, `screenToFlowPosition`, `getNodesBounds`, `setNodes`, `updateNode` on the instance | `dist/esm/types/general.d.ts` L104–158, `types/instance.d.ts` L34–188 | VERIFIED |
| Store exposes `transform`, `nodeLookup`, `triggerNodeChanges`; `useStore`/`useStoreApi` re-exported | `dist/esm/types/store.d.ts` L7–109, `hooks/useStore.d.ts` | VERIFIED |
| `onPaneMouseMove`, `onPaneMouseLeave` props exist | `dist/esm/types/component-props.d.ts` L200–202 | VERIFIED |
| Node wrapper `onKeyDown` nudges on Arrow keys with `preventDefault`, factor 4 with Shift, no Ctrl/Meta check (→ D-10g) | `dist/esm/index.js` ~L2312–2320 | VERIFIED |
| `NodeToolbar` accepts `nodeId: string[]`, `isVisible`, `position`, `align` | F08 02-design verified row (2026-10-22); unchanged in 12.12.0 | VERIFIED (F08) |
| One `onNodesChange` call = one Liveblocks batch = one undo entry | F08 02-design (`@liveblocks/react-flow` docs, 2026-10-22); F08 AC-017 passes | VERIFIED (F08) |
| Liveblocks: a remote change does not clear the local redo stack | not stated on fetched pages | UNVERIFIED — asserted by AC-042; fallback: document the observed behaviour in status.md |
| `ClipboardEvent.clipboardData.getData('text/plain')` available in `paste` handlers without permission in Chromium/Firefox/WebKit; `readText()` may prompt or reject | MDN Clipboard API (not re-fetched) | UNVERIFIED — design already degrades to the memory copy (EC-014/015) |
| `lucide-react` exports `Grid3x3`, `ClipboardPaste`, `Scissors`, `Copy`, `AlignStartVertical`… | `node_modules/lucide-react/dist/lucide-react.d.ts` (names present) | VERIFIED |
