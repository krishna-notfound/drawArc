# F08 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | A selected node shall render `<NodeResizer>` with `minWidth={48}`, `minHeight={32}`, `keepAspectRatio={shape === 'circle'}`, `isVisible={selected && canEdit}`; unselected nodes and all nodes for viewers shall render no resize controls. | must | PRD-022, US-1, US-7 | AC-001, AC-002 |
| FR-002 | Resizing shall flow through the F06 hook's `onNodesChange` as React Flow's `NodeDimensionChange` (with `setAttributes`) and `NodePositionChange`; after `onResizeEnd` the node's `width`/`height` (and `position` when a top/left handle was used) in Storage shall equal the rendered size, and other clients shall render the same size. | must | PRD-022, US-6 | AC-003, AC-004 |
| FR-003 | Attempting to resize below 48 × 32 shall clamp to 48 × 32 (no change below), and the circle shall stay square throughout a resize. | must | PRD-022 | AC-005 |
| FR-004 | A complete resize gesture (start → end) and a complete drag shall each produce exactly one undo entry for the author; undo restores the pre-gesture `width/height/position`. | must | PRD-027, D-013 | AC-006 |
| FR-005 | Resize handles shall be 8 × 8 px, `--accent-primary` fill, 1 px `--bg-base` border, `rounded-[2px]`; resize lines `--accent-primary` at 60 % opacity, 1 px; the handles shall not be scaled by the viewport zoom. | must | ui-context "Shapes" | AC-007 |
| FR-006 | Double-clicking a node's body (or pressing `Enter` while the node is focused and `canEdit`) shall open the label editor: a `<textarea>` overlaying the label area, text centred, pre-filled with `data.label`, caret at end, all text selected, `maxLength={200}`, `aria-label="Node label"`, classes `nodrag nowheel nopan`. | must | PRD-023, US-2, US-5 | AC-008, AC-009 |
| FR-007 | While the editor is open: `Enter` commits; `Shift+Enter` inserts a newline; `Escape` cancels (restores the pre-edit label, writes nothing); blur commits. Commit writes `data.label` once via `updateNodeData(id, { label })` only if the trimmed value differs from the stored one. | must | PRD-023, D-08a | AC-010, AC-011 |
| FR-008 | Every `keydown`/`keyup`/`keypress` originating in the textarea shall be stopped from propagating to the React Flow node/pane and to the window (`stopPropagation`), so Backspace, Delete, arrows, `+`, `-`, `?`, ⌘/Ctrl+Z inside the editor edit text only; the node shall not be dragged, deleted, nudged, or deselected by those keys, and the canvas shall not zoom on wheel over the textarea. | must | PRD-023, US-3 | AC-012 |
| FR-009 | An empty label shall render a faint placeholder "Double-click to label" (`--text-faint`, not selectable, not persisted, not announced beyond the node's `aria-label` "… unlabelled") in the same centred position as the label, with no layout shift when the editor opens or closes. | must | PRD-023 | AC-013 |
| FR-010 | If the node being edited is removed from `nodes` (deleted by another user, by import, or by undo), the editor shall unmount without committing, without throwing, and without emitting any change. | must | US-8, testing-strategy collab list | AC-014 |
| FR-011 | A colour toolbar shall render via `<NodeToolbar nodeId={selectedNodeIds} isVisible={selectedNodeIds.length > 0 && canEdit} position={Position.Top} offset={12} align="center">` containing eight swatch buttons in `NODE_COLOR_IDS` order; each swatch is a 20 × 20 px circle filled with `NODE_COLORS[id].fill`, 2 px ring `NODE_COLORS[id].text`, `aria-label="Colour: <id>"`, `role="radio"` inside `role="radiogroup"` `aria-label="Node colour"`; the active swatch (`aria-checked=true`) when all selected nodes share that colour shows a 2 px outer `--accent-primary` ring and a `Check` icon; hover shows `box-shadow: 0 0 0 3px <text colour at 33 % alpha>`. | must | PRD-024, US-4, D-08b | AC-015, AC-016 |
| FR-012 | Activating a swatch (click, `Enter`, `Space`) shall set `data.color` on every selected node in one batched mutation (one undo step, one message); arrow keys move focus between swatches (roving tabindex); the toolbar has classes `nodrag nopan` so interacting with it never drags or pans. | must | PRD-024, US-5, D-08b | AC-017, AC-018 |
| FR-013 | For `role === 'viewer'`: no resizer, no colour toolbar, double-click/Enter does not open the editor; `useCanvasMutations` guards remain the second line of defence. | must | PRD-012, US-7 | AC-019 |
| FR-014 | The node label at rest shall render `data.label` with `white-space: pre-wrap`, centred, `overflow: hidden`, up to 5 lines (`-webkit-line-clamp: 5`), in `NODE_COLORS[color].text`, font Geist Sans 14 px/1.3, padding 8 px; the textarea overlay shall use the identical font, size, line-height, padding and colour so opening the editor causes no visual jump. | must | PRD-023 | AC-013, AC-020 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | Label commit / colour change / resize end each produce one Storage write; TC-0xx measure A → B render < 1 s. |
| NFR-004 | The toolbar subscribes to selected ids through a narrow `useStore` selector (`state.nodes.filter(n => n.selected).map(n => n.id)` with shallow equality), not to the full `nodes` array; the label editor is mounted only while editing; `CanvasNode` stays memoised (F07). |
| NFR-006 | Editor opens with `Enter` on a focused node; swatch radiogroup with roving tabindex; `aria-label`s; focus returns to the node element after commit/cancel; contrast of all 8 pairs ≥ 4.5:1 (unit test from F06/ui-context is referenced, not duplicated). |
| NFR-007 | `NodeResizer` props typed; `updateNodeData` patch typed as `Partial<CanvasNodeData>`; no `any`. |

## UX and interaction behaviour

- **Resizer**: appears only with selection; corner and edge handles (React Flow default set); cursor per handle (library default). The selected border (F07) and the resizer lines overlap — lines are drawn at 60 % so the brand border remains the dominant cue (colour is not the only cue: thickness also changes, ui-context a11y).
- **Editor open paths**: double-click anywhere on the node body (not on a handle or the resizer); `Enter` when the node has focus (React Flow focuses nodes on click/Tab). Opening does not change selection.
- **Editor close paths and results**:

| Trigger | Result |
|---|---|
| `Enter` | commit (if changed), close, focus node |
| `Shift+Enter` | newline inserted (counts toward 200) |
| `Escape` | discard draft, close, focus node |
| blur (click elsewhere, Tab, another node's editor opening) | commit (if changed), close |
| node removed from `nodes` | close, no commit (FR-010) |
| role downgraded to viewer mid-edit (F05 `ROLE_CHANGED` → `client.logout()` + full reload) | the reload unmounts the editor; nothing is committed; the pending draft is lost (documented) |

- **Copy**: placeholder "Double-click to label"; textarea `placeholder` attribute "Label"; toolbar tooltip per swatch "Neutral", "Blue", "Purple", "Orange", "Red", "Pink", "Green", "Teal".
- **Colour toolbar position**: 12 px above the top edge of the selection bounds, centred; `NodeToolbar` does not scale with zoom (verified), so swatches are always 20 px. Toolbar surface: `rounded-xl bg-surface/95 border border-surface-border shadow-lg p-1 flex gap-1`.
- **Multi-select**: toolbar shows above the union bounds; a swatch with mixed state shows no check; choosing one colours all.
- **Reduced motion**: no transitions on toolbar appear/disappear.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Another user deletes the node while this user's editor is open | Editor unmounts, no commit, no console error, no orphan node reappears | AC-014 |
| EC-002 | Resize dragged below 48 × 32 | Clamped at 48 × 32; Storage never receives a smaller size | AC-005 |
| EC-003 | Users A and B edit the same label; A commits "alpha" at t, B commits "beta" at t + 50 ms | Both converge on "beta" (last to reach the server wins, per key); no error; documented D-014 outcome | AC-021 |
| EC-004 | A drags node X; B drags node X at the same time | Both converge on the last position received by the server within 2 s | AC-022 |
| EC-005 | A undoes a resize of X after B has since resized X | A's undo re-applies A's pre-size, overwriting B's (no rebase, liveblocks.md §3); both clients converge; no crash | AC-023 |
| EC-006 | Label of exactly 200 characters, or paste of 1 000 characters | Textarea refuses beyond 200 (`maxLength`); commit stores ≤ 200; paste truncated | AC-011 |
| EC-007 | Label of 20 lines | Stored intact; rendered clamped to 5 lines with hidden overflow; editor shows a scrollable textarea (`nowheel`) | AC-020 |
| EC-008 | Double-click while a different node's editor is open | First editor blurs → commits; second opens; no lost text | AC-010 |
| EC-009 | Commit with unchanged text | No `updateNodeData` call; no undo entry | AC-010 |
| EC-010 | Role becomes viewer while editing (`ROLE_CHANGED` → `client.logout()` + reload → read token, F05/F12) | The page reloads, so the editor unmounts without commit; if a commit raced the reload the room rejects it (read token). Unit case: `canEdit` flipping to false closes the editor without a write | AC-019 (unit part) |
| EC-011 | Swatch clicked with 50 nodes selected | One batched mutation; one undo entry; all 50 recoloured on both clients | AC-017 |
| EC-012 | Resize on a node with an open editor | Resizer and editor coexist; textarea stretches with the node; no commit until Enter/blur | AC-020 (manual part) |
| EC-013 | Offline during commit | Change queued, applied locally, sent on reconnect (liveblocks.md §8) | F07/AC-023 pattern; TC-0xx here reuses it for a label |
