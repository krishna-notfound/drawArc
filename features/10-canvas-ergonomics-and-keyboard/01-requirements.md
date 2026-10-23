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
| EC-011 | Holding Space then dragging on a node | Pans (React Flow `panActivationKeyCode`); no node move | AC-015 |
| EC-012 | 200 selected elements duplicated | One batch; one undo; copies selected; completes < 500 ms on the perf fixture | AC-013 |
| EC-013 | Context menu opened on a node, then that node is deleted remotely | Menu closes (state cleared when the target id disappears from the store) | AC-016 (unit case) |
