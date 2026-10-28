# F10 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The workspace shall render a bottom-left control bar pill (`fixed left-4 bottom-4`, `rounded-xl bg-surface/95 border border-surface-border shadow-lg p-1`) with buttons in order: Zoom out (`Minus`), Fit view (`Maximize`), Zoom in (`Plus`), a 1 px vertical divider (`bg-surface-border`, 20 px tall), Undo (`Undo2`), Redo (`Redo2`); buttons 32 × 32 px, icons `h-4 w-4`; each has an `aria-label` and a tooltip "<Action> (<shortcut>)": "Zoom out (−)", "Fit view (Shift+1)", "Zoom in (+)", "Undo (⌘Z)"/"(Ctrl+Z)", "Redo (⌘⇧Z)"/"(Ctrl+Shift+Z)" chosen by platform. | must | PRD-027, ui-context layout | AC-001, AC-002 |
| FR-002 | Zoom buttons and shortcuts shall call `useReactFlow().zoomIn({ duration: 200 })`, `zoomOut({ duration: 200 })`, `fitView({ duration: 200, padding: 0.2 })`; zoom is clamped by F06's `minZoom={0.1}`/`maxZoom={4}` (F06/FR-008). | must | PRD-027 | AC-003 |
| FR-003 | Undo/Redo shall call Liveblocks `useUndo()`/`useRedo()`; the buttons shall be `disabled` (and `aria-disabled`, opacity 40 %) when `useCanUndo()`/`useCanRedo()` is false; for viewers the undo/redo group and divider are not rendered. | must | PRD-027, D-013 | AC-004, AC-005 |
| FR-004 | `hooks/useKeyboardShortcuts.ts` shall attach one `keydown` listener to `window` and ignore events per D-10e (editable targets, open dialogs, `isComposing`). | must | PRD-027, code-standards | AC-006, AC-007 |
| FR-005 | `Delete` and `Backspace` shall collect selected nodes and edges from the React Flow store at event time and call `onDelete({ nodes, edges })` once if either set is non-empty; with nothing selected nothing is called and no history entry is created. React Flow's `deleteKeyCode` stays `null` (F06). **(reference bug §2)** | must | PRD-027, US-1, D-10a | AC-008, AC-009 |
| FR-006 | Shortcut map (case-insensitive, `mod` = `metaKey` on macOS or `ctrlKey` elsewhere, both accepted): `mod+z` undo; `mod+shift+z` redo; `mod+y` redo; `+` or `=` (no modifier) zoom in; `-` (no modifier) zoom out; `shift+1` (`code === 'Digit1'`) fit view; `Escape` clear selection (when a node is not focused — React Flow handles the focused case); `mod+a` select all nodes and edges; `mod+d` duplicate selection; `?` (`shift+/`) open the cheat-sheet. Handled events call `preventDefault()`. Arrow-key nudge is React Flow's built-in behaviour and is not re-implemented. | must | PRD-027, ui-context table | AC-010, AC-011, AC-012 |
| FR-007 | Duplicate shall create, in one batch, copies of all selected nodes (`newNodeId(shape)`, `position + {20, 20}`, same `width/height/data`) and of all edges whose source and target are both selected (`newEdgeId()`, endpoints remapped), then select exactly the copies; it is a no-op with no selection. | must | US-4, D-10d | AC-013, AC-014 |
| FR-008 | Selection configuration shall be: drag on empty pane draws a selection box (`selectionOnDrag`), `selectionMode="partial"` (overlap selects), Shift+drag also boxes (`selectionKeyCode="Shift"`), ⌘/Ctrl+click toggles an element in the selection (`multiSelectionKeyCode`), middle/right drag pans (`panOnDrag={[1, 2]}`), Space+drag pans (`panActivationKeyCode="Space"`), click on the pane clears the selection. | must | PRD-022, ui-context table | AC-015 |
| FR-009 | Right-clicking a node, an edge, or the pane shall open a context menu at the pointer with: node → "Duplicate" (`⌘D`), "Delete" (`Del`); edge → "Delete" (`Del`); pane → "Select all" (`⌘A`), "Fit view" (`⇧1`). The menu shall close on outside click, pane click, `Escape`, and after an action; be navigable with arrow keys and activated with `Enter`; flip/shift so it stays within the viewport; and not open after a right-drag pan (pointer moved > 4 px). Node/edge menus apply to the whole current selection if the right-clicked element is part of it, else to that element only (it becomes the selection). | must | US-5, D-10b | AC-016, AC-017, AC-018 |
| FR-010 | `?` and a "Keyboard shortcuts" item in the pane context menu shall open a shadcn `Dialog` titled "Keyboard shortcuts" whose rows reproduce `ui-context.md` "Interaction conventions" verbatim (Action / Input columns), plus rows for "Select all", "Duplicate", "Clear selection", "Keyboard shortcuts (this dialog)"; for viewers the rows Box select, Add to selection, Add node, Edit label, Delete, Undo / redo, Context menu, Select all, Duplicate and Clear selection are omitted (viewers cannot select: F06 sets `elementsSelectable={false}`). | must | PRD-027, US-6, US-7 | AC-019, AC-020 |
| FR-011 | For viewers every mutating shortcut (Delete/Backspace, undo, redo, duplicate) and every mutating menu item shall be a no-op and absent from menus; selection shortcuts (`mod+a`, `Escape`) are no-ops because F06 disables selection for viewers; navigation shortcuts (zoom, fit, `?`) remain, and the pane context menu shows "Fit view" and "Keyboard shortcuts" only. | must | PRD-012, US-7 | AC-021 |
| FR-012 | Redo availability shall be cleared by a new local change (`useCanRedo()` false after undo → new change), and undo after a remote change to the same key shall re-apply the local inverse without rebasing (documented outcome). | must | D-013 | AC-022, AC-023 |
| FR-013 | Below 768 px width the control bar shall move up (`bottom-20`) so it does not overlap the F07 palette; MiniMap hiding under 768 px is F06's. | should | ui-context | AC-002 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | Delete/duplicate are single batched writes; TC-0xx records A → B latency for a delete. |
| NFR-004 | One window listener; selection read via `getState()` at event time; control bar subscribes only to `useCanUndo/useCanRedo`; context menu state is `{ kind, id, x, y } \| null` in one `useState`. |
| NFR-006 | All buttons labelled with tooltips; menu and dialog are Radix (focus trap, Esc, arrow keys); cheat-sheet discoverable via `?` and menu; disabled states use opacity **and** `aria-disabled`. |
| NFR-007 | Shortcut map typed as a discriminated union of actions; exhaustive `switch`. |

## UX and interaction behaviour

- **Control bar**: hover `bg-subtle`; focus-visible ring; disabled `opacity-40 cursor-not-allowed`. Tooltips from shadcn `Tooltip`, 300 ms delay. Viewer sees three zoom buttons only.
- **Platform labels**: `navigator.platform`/`userAgentData` → macOS shows `⌘`/`⇧`; others `Ctrl`/`Shift`. Same helper feeds tooltips, menu hints and the cheat-sheet.
- **Context menu**: surface `rounded-xl bg-elevated border border-surface-border shadow-xl p-1 min-w-44`; items `text-sm text-copy-primary` with right-aligned hint in `text-copy-faint`; destructive "Delete" in `text-error`. Opens at the pointer; Radix collision padding 8 px.
- **Cheat-sheet**: `Dialog` `rounded-3xl`, title "Keyboard shortcuts", description "Shortcuts are ignored while typing in a text field.", two-column table, close button, Esc closes. Content:

| Action | Input |
|---|---|
| Pan | scroll / middle-drag / right-drag / Space+drag |
| Zoom | ⌘/Ctrl+scroll, pinch, `+`/`=`/`-`, control bar |
| Fit view | control bar, `Shift+1` |
| Box select | drag on empty canvas (partial overlap selects) |
| Add to selection | Shift+click (box) · ⌘/Ctrl+click (toggle) |
| Add node | drag from palette; ghost preview follows cursor; drop centres node under cursor |
| Edit label | double-click node/edge; Enter commits (Shift+Enter newline in nodes); Esc cancels; blur commits |
| Delete | Delete / Backspace (not while editing text) |
| Undo / redo | ⌘/Ctrl+Z · ⌘/Ctrl+Shift+Z · ⌘/Ctrl+Y |
| Context menu | right-click node/edge/pane → duplicate, delete (feature 10; no z-order commands — `zIndex` is not synced by `@liveblocks/react-flow`) |
| Select all | ⌘/Ctrl+A |
| Duplicate | ⌘/Ctrl+D |
| Clear selection | Esc |
| Keyboard shortcuts | ? |

  The first ten rows are copied verbatim from `context/ui-context.md` "Interaction conventions" (already amended for D-10c — no "bring to front"); the copy test (AC-019) compares against that table as the source of truth, so any future edit there fails the test until this file follows.

- **Escape precedence**: open dialog → closes dialog (Radix); open context menu → closes menu; open label editor → F08 cancels (event never reaches window); otherwise → clear selection.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Shortcut key pressed while a shadcn dialog (share, import, cheat-sheet) is open | Ignored (D-10e); Delete inside a dialog input edits text only | AC-007 |
| EC-002 | Delete with nothing selected | No `onDelete` call; `useCanUndo()` unchanged | AC-009 |
| EC-003 | A moves X; B then moves X; A presses undo | X returns to A's pre-move position on both clients (inverse applied without rebase, liveblocks.md §3, S10); no crash; both converge ≤ 2 s | AC-023 |
| EC-004 | A undoes, then makes a new change | `useCanRedo()` is false; Redo button disabled | AC-022 |
| EC-005 | Right-click within 8 px of the viewport's right/bottom edge | Menu flips/shifts to stay fully visible | AC-018 |
| EC-006 | Right-drag to pan (Windows fires `contextmenu` on mouseup) | No menu after a drag > 4 px | AC-017 |
| EC-007 | ⌘/Ctrl+D with nothing selected; ⌘/Ctrl+D as viewer | No-op; browser bookmark still prevented for editors, not prevented for viewers (key not handled) | AC-014, AC-021 |
| EC-008 | Delete pressed while another user is editing the label of a selected node | Node and edges removed; F08 closes the remote editor without a write | F08/AC-014; here AC-008 |
| EC-009 | Undo when history was cleared by reload | `useCanUndo()` false → button disabled; shortcut no-op (documented: history is per connection) | AC-004 |
| EC-010 | Shortcut while focus is inside the AI sidebar's textarea (M2) or the share dialog's email input | Ignored by the editable-target rule | AC-006 |
| EC-011 | Holding Space then dragging on a node | Moves the node (React Flow 12 behaviour; corrected 2026-10-24, D-049); Space+drag on the empty pane pans | AC-015 |
| EC-012 | 200 selected elements duplicated | One batch; one undo; copies selected; completes < 500 ms on the perf fixture | AC-013 |
| EC-013 | Context menu opened on a node, then that node is deleted remotely | Menu closes (state cleared when the target id disappears from the store) | AC-016 (unit case) |

## v2 — canvas productivity (2026-10-28)

### Functional requirements (continue v1 numbering)

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-014 | `lib/canvas/registry.ts` shall be the single source of truth for every canvas shortcut: an array of bindings `{ action, chords[], label, group, mutating, viewerVisible, handledBy }` plus a `RESERVED_CHORDS` map for letters owned by other features (`t`, `n` → F22; `f` → F23; `x` → F21; `i` → F24). `matchShortcut`, `formatKeys`, `ariaKeyShortcuts`, the cheat-sheet rows after the ten verbatim ui-context rows, and every control/menu `<kbd>` hint shall be derived from it; no component shall hard-code a chord. A unit test shall fail when any normalised chord appears in two bindings or in a binding and `RESERVED_CHORDS`. Every button and menu item with a binding shall carry `aria-keyshortcuts` (C6; F-15, F-16, F-18, F-29, R-011). | must | PRD-027, NFR-006 | AC-025, AC-026 |
| FR-015 | Pressing `R`, `D`, `O`, `P`, `C`, `H` (no modifier, case-insensitive, CapsLock-safe) shall create a rectangle / diamond / circle / pill / cylinder / hexagon through `useCanvasMutations.addNode` centred on the last pointer position over the canvas (`screenToFlowPosition` + `centredDropPosition`, F07 FR-004) or on the viewport centre when the pointer is not over the canvas (F07 FR-007); the new node becomes the selection; `Esc` afterwards clears it (D-053 unchanged). `T`/`N` shall be reserved in `RESERVED_CHORDS` and inert until F22 registers `addText`/`addSticky` (ordering rule D-10j; F22 FR-008) (F-20, R-009). | must | US-13, C6 | AC-027 |
| FR-016 | `mod+C` / `mod+X` and the node/selection context-menu items "Copy" / "Cut" shall serialise the selected nodes and the edges whose both ends are selected (D-10d rule) into `{ type: 'drawarc-clipboard', schemaVersion, nodes, edges }` using the persisted shapes (`toDocument` rules, runtime keys stripped), write it as text via `navigator.clipboard.writeText`, and keep an in-memory copy; cut shall additionally delete the selection through `onDelete` exactly as Delete does (one undo entry). With nothing selected both are no-ops and the browser default is not prevented (F-11, F-C01, F-C06, R-001). | must | US-9, C3 | AC-028, AC-029 |
| FR-017 | Paste (`mod+V` via the `paste` event; pane/selection context-menu item "Paste") shall: take the text, reject anything over `CLIPBOARD_MAX_CHARS` (1 000 000) or that fails `ClipboardEnvelopeSchema` (Zod; `schemaVersion ≤ CANVAS_SCHEMA_VERSION`, ≤ 500 nodes, ≤ 1 000 edges, node/edge schemas from `lib/canvas/schema.ts`, older versions migrated with `migrate`); give every node a new `${kind}_${ulid}` id (`newNodeId`, F07 — widened to every kind by F22 FR-002) and every edge a new `e_` id; remap endpoints; drop edges whose ends are not both in the envelope; translate the group so its bounding-box centre lands at the last pointer position (viewport centre when the pointer is off-canvas) keeping relative layout; add nodes then edges in one `room.batch` (one undo entry); then select exactly the pasted items. A second paste mints fresh ids again (F-C03, F-C06). | must | US-9, C3 | AC-030, AC-031, AC-032 |
| FR-018 | Non-envelope clipboard text shall create one text node through F22's `addNodeOfKind('text', pos, { label })` (F22 FR-007; `shape: 'text'`, `autoWidth: true`, label = text trimmed to F22's `TEXT_MAX_LENGTH` = 500) at the pointer **only if** the kind list (`NODE_KINDS` from F22 FR-002 via the `lib/canvas/kinds.ts` shim, D-10j) contains `'text'`; otherwise paste shall do nothing and write nothing. Pasting while focus is in a text field is never intercepted (v1 ignore rules). | should | C3, D-057 | AC-033 |
| FR-019 | `mod+'` (`code === 'Quote'`) and a control-bar toggle "Grid" (`aria-pressed`, `Grid3x3` icon, after Fit view) shall switch a per-user grid: on → `<ReactFlow snapToGrid snapGrid={[20, 20]}>` and `<Background variant="lines" gap={20}>`; off → v1 dots, no snapping. The value shall persist in `localStorage['drawarc.grid']` and never be written to Storage; it is available to viewers; toggling creates no undo entry (F-53, F-S03, R-002, D-10i). | must | US-10 | AC-034, AC-035 |
| FR-020 | `mod+shift+ArrowLeft/Right/Up/Down` shall align the selected nodes' left / right / top / bottom edges to the selection's bounding box; "Align centre (horizontal)" and "Align middle (vertical)" shall be available from the selection toolbar and the node/selection context-menu "Align" submenu together with the four edges. Requires ≥ 2 movable nodes; nodes with `data.locked === true` (F22 schema v2 optional field `locked`, same name) are excluded; writes are one batched `replace` change set (one undo entry); when no node would move nothing is written (F-24, F-S05, R-003). | must | US-11 | AC-036, AC-037 |
| FR-021 | "Distribute horizontally" / "Distribute vertically" (toolbar + menu, no default key) shall space ≥ 3 movable nodes so the gaps between consecutive bounding boxes are equal, keeping the first and last in place along that axis; one undo entry (F-S06, R-004). | must | US-11 | AC-036, AC-038 |
| FR-022 | When ≥ 2 nodes are selected and the member can edit, a selection toolbar (`<NodeToolbar nodeId={ids} position="bottom">`, `nodrag nopan`, beside F08's colour toolbar) shall show six align buttons and, from 3 nodes, two distribute buttons; each with `aria-label`, tooltip with hint and `aria-keyshortcuts` where bound. | must | US-11, NFR-006 | AC-037 |
| FR-023 | `Shift+2` (`code === 'Digit2'`) and a pane/selection menu item "Zoom to selection" shall call `fitView({ nodes: selected, duration: 200, padding: 0.2 })`; with no selection it fits all (D-10h). | must | US-12, F-50, R-010 | AC-039 |
| FR-024 | The control bar shall render a zoom readout button between Zoom out and Zoom in showing `${Math.round(zoom × 100)} %` (tabular numerals, fixed min-width, `aria-label="Zoom 100 %, reset to 100 %"`, not `aria-live`); clicking it calls `zoomTo(1, { duration: 200 })`; Zoom in is `disabled` at `maxZoom` (4) and Zoom out at `minZoom` (0.1), tooltips kept (F-49, R-010). | must | US-12 | AC-040 |
| FR-025 | Undo set (explicit): undo/redo cover node and edge content and positions only; selection, viewport, grid and cheat-sheet state never create or consume an entry; a remote user's change never clears the local redo stack; `mod+Z`/`mod+Y` are no-ops while a local drag or resize is in progress (`nodes.some(n => n.dragging \|\| n.resizing)`); system writes (F13 restore, F14 import for non-importers) create no local entries (F-02, F-03, F-04, F-06, F-08, R-012). | must | D-013, PRD-027 | AC-041, AC-042 |

### Non-functional requirements exercised (v2 additions)

| NFR | How v2 meets it |
|---|---|
| NFR-003 | Paste, cut, align and distribute are each one batched write; paste is capped at 500 nodes / 1 000 edges / 1 MB. |
| NFR-004 | Pointer position is a ref updated by `onPaneMouseMove`, never state; zoom readout and disabled flags use narrow `useStore` selectors on `transform[2]`; the selection toolbar subscribes to selected ids with shallow equality (F08 pattern); grid preference via `useSyncExternalStore`. |
| NFR-005 | Clipboard input is validated with Zod before any id is minted; invalid input never reaches Storage. |
| NFR-006 | `aria-keyshortcuts` everywhere a binding exists; `aria-pressed` on the grid toggle; readout not announced on every frame. |
| NFR-007 | `ShortcutAction` union grows; `run()` stays exhaustive; registry typed `readonly ShortcutBinding[]`. |

### UX and interaction behaviour (v2)

- **Control bar order**: Zoom out · `100 %` · Zoom in · Fit view · Grid · divider · Undo · Redo (viewers: first five). Width grows by ~72 px; the FR-013 mobile offset is unchanged.
- **Context menu**: node/selection → Copy, Cut, Paste, Duplicate, Align ▸ (6 + 2 items, predicates per FR-020/021), Zoom to selection, Delete; edge → Delete only (an edge alone is never copied); pane → Paste, Select all, Fit view, Zoom to selection, Keyboard shortcuts. Items whose predicate fails are omitted and adjacent separators collapse (F-29). Hints come from `formatKeys` on the registry.
- **Cheat-sheet rows appended after the v1 rows** (editor only unless noted): Copy / Cut / Paste `⌘/Ctrl+C` · `⌘/Ctrl+X` · `⌘/Ctrl+V`; Add shape at pointer `R` `D` `O` `P` `C` `H`; Grid `⌘/Ctrl+'` (viewer-visible); Align `⌘/Ctrl+Shift+Arrow`; Zoom to selection `Shift+2` (viewer-visible). The first ten rows stay verbatim (AC-019 unchanged).
- **Escape precedence** unchanged (D-053). **Platform labels** unchanged; `aria-keyshortcuts` uses the W3C form `"Control+Shift+Z Meta+Shift+Z"` (both modifiers listed, since both are accepted).

### Error handling and edge cases (continue v1 numbering)

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-014 | `navigator.clipboard` missing (insecure context) or `writeText` rejects | Copy still succeeds into the in-memory copy; no error UI; a later paste in the same tab works | AC-029 |
| EC-015 | Menu Paste when `readText` is unavailable or denied | Falls back to the in-memory copy; if that is empty the item is a no-op | AC-029 |
| EC-016 | Clipboard text is not JSON, is JSON of another shape, has `type` ≠ `drawarc-clipboard`, or `schemaVersion` newer than the client | Nothing written, no selection change, no undo entry (plain text → FR-018) | AC-031 |
| EC-017 | Envelope exceeds 500 nodes, 1 000 edges or 1 MB of text | Rejected whole; no partial paste | AC-031 |
| EC-018 | Envelope edge references a node id that is not in `nodes` | That edge is dropped; the rest pastes | AC-030 |
| EC-019 | Paste when the pointer is over the sidebar or outside the window | Group centred on the visible viewport centre | AC-032 |
| EC-020 | Cut, then undo | Nodes and attached edges return in one step; clipboard still holds the envelope; a paste then yields fresh ids | AC-028 |
| EC-021 | Align with < 2 movable nodes; distribute with < 3; all nodes already aligned | No write, no undo entry; menu items/toolbar buttons disabled or hidden | AC-036 |
| EC-022 | Selection contains locked nodes (F22) | Excluded from the move set and from the bounding box; if fewer than 2/3 remain → EC-021 | AC-036 |
| EC-023 | `localStorage` throws (private mode, quota) | Grid defaults off and still toggles for the session | AC-035 |
| EC-024 | Letter key with `mod`/`alt` held (`Ctrl+R` reload, `Ctrl+H` history) or pressed by a viewer | Not matched; browser default untouched | AC-027 |
| EC-025 | Zoom already at 4 / 0.1 | Zoom in / out button disabled; `+`/`-` no-op; readout `400 %` / `10 %` | AC-040 |
| EC-026 | Paste of 500 nodes | One batch; completes < 1 s on the perf fixture; copies selected | AC-030 (unit) + AC-032 |
| EC-027 | `mod+shift+Arrow` with a selected node focused | Align runs (capture phase, D-10g) and React Flow does not also nudge | AC-037 |
