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
