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

---

## v2 — richer node editing (2026-10-28)

Field names below are the schema v2 fields F08 v2 needs from F22 (D-057); F08 does not define the migration. Defaults apply whenever the field is absent (every v1 document).

```ts
data.color:   NodeColorId | HexColor          // D-063; HexColor = `#${string}` validated as /^#[0-9a-fA-F]{6}$/ (F22 FR-004); F08 writes lowercase
data.text?:   { size: 's'|'m'|'l'|'xl'; align: 'left'|'center'|'right'; valign: 'top'|'middle'|'bottom'; bold: boolean }
              // F22 FR-003; default DEFAULT_TEXT[kind] = { size: 'm', align: 'center', valign: 'middle', bold: false } for the six shapes (= v1 rendering); text/sticky default left/top
data.border?: { style: 'none'|'solid'|'dashed'|'dotted'; width: 1|2|3 }   // F22 FR-003; default DEFAULT_BORDER[kind] = { style: 'solid', width: 1 } for the six shapes (= v1); 'dotted' is rendered but has no UI (O-v2-6)
// TEXT_SIZE_PX = { s: 12, m: 14, l: 20, xl: 28 } and MIN_SIZES per kind are F22's (types/canvas.ts)
```

### Functional requirements (v2)

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-015 | While a resize drag is active (between `onResizeStart` and `onResizeEnd`), holding Shift shall keep the aspect ratio captured at drag start for every shape (`keepAspectRatio` true); releasing Shift mid-drag shall free the ratio again; circle stays locked regardless. Shift state shall be read from the drag event's `sourceEvent` only — no window key listener — so Shift outside a resize drag keeps its F10 FR-008 box-select meaning. | must | R-007 (01§T4), US-9, D-08f | AC-025, AC-026 |
| FR-016 | **P3 (optional, owner decides at approval):** holding Alt during a resize drag shall resize symmetrically from the node's centre: each `onResize` emits, in the same gesture, a `NodePositionChange` shifting the origin by half the size delta and a `NodeDimensionChange` doubling the delta; the gesture remains one undo step. | should (P3) | R-048 (01§T5) | AC-027 |
| FR-017 | On a label commit (FR-007) or a text-option change (FR-019, FR-020) the node's `height` shall be set to `clamp(currentHeight, fitHeight, 480)` where `fitHeight` = DOM-measured content height of the label at the node's current width and text options + 16 px padding + 2 × border width; the height and the data change shall be written as one `replace` change (one undo step). Height never auto-shrinks. Measurement is DOM-based (hidden measurer or the editor's textarea), never canvas `measureText` (01§X10). | must | R-008 (01§R4, X10), US-10, D-08e | AC-028, AC-029 |
| FR-018 | During a resize the resizer's `minHeight` shall be `max(32, fitHeight(width))` recomputed on each `onResize`, so a user cannot drag the node shorter than its text; at `onResizeEnd`, if the new width made `fitHeight` exceed the height, the height shall be raised to `min(fitHeight, 480)` inside the same history step as the gesture (`history.pause()` at start, `resume()` after the fit write). Above 480 px the label clips with `overflow: hidden` (v1 behaviour, no line clamp). | must | R-008, D-08e, FR-003 | AC-028, AC-030 |
| FR-019 | The label at rest and the editor textarea shall render `data.text`: size from F22's `TEXT_SIZE_PX` (`s`=12, `m`=14, `l`=20, `xl`=28 px — one table for every kind; line-height 1.3; Geist Sans only); `align` → `text-align`; `valign` → vertical placement of the label block inside the shape (`justify-content: flex-start / center / flex-end` on the label column); absent `data.text` renders exactly as v1 (FR-014). The FR-014 typography contract (identical rest/editor styles) is kept for every size. | must | R-027 (01§X6, X7, X9; 03§F-36), US-11 | AC-031 |
| FR-020 | `data.text.bold` true shall render the label at font-weight 600; Ctrl/⌘+B inside the open editor shall toggle bold for that node, written with the pending draft at commit (not immediately; Esc discards it with the draft, D-053). | must (shortcut: should) | 03§F-36, US-11 | AC-031, AC-041 |
| FR-021 | `data.border` shall render on every shape: `solid` / `dashed` (CSS `border-style`; SVG shapes `stroke-dasharray="6 4"` with `vector-effect: non-scaling-stroke`) / `none` (no outline at rest); width 1, 2 or 3 px. A selected node keeps its style but uses the brand colour at `max(2, width)` px; a `none` border shows a solid 2 px brand outline while selected so selection never depends on colour alone (NFR-006). The v1 drag ghost is unaffected. F22 reserves `dotted` (F22 FR-003); the renderer maps it to CSS `dotted` / `stroke-dasharray="2 4"` with no UI for it (O-v2-6). | must | R-028 (03§F-32, F-33), US-11 | AC-032, AC-039 |
| FR-022 | `data.color` may be a palette id or a lowercase `#rrggbb`. For a hex, the fill is the hex and the text colour is derived by F22's `resolveColor` (`lib/canvas/color.ts`) — pure `#FFFFFF` or `#000000` by WCAG relative luminance (D-08g; formula in 02-design; resolved at validation 2026-10-28 and shared with F22 FR-004); the derived colour is never stored. A hex equal (case-insensitively) to a palette fill shall be stored as that palette id. Unknown non-hex strings render `neutral` with the v1 warning. | must | D-063, R-031 (03§F-41), US-12 | AC-033 |
| FR-023 | The colour group of the toolbar shall add a "More colours" control that expands an inline row with: a hex `<input>` (`aria-label="Hex colour"`, `maxLength=7`, accepts `#abc`, `abc`, `#aabbcc`, `aabbcc`; normalises to `#aabbcc`; Enter applies; invalid → `aria-invalid="true"`, not applied; when the selection contains a `text`-kind node, a hex failing F22's `textContrastOk('text', hex)` against `--bg-base` is refused the same way with the tooltip "Too low contrast" — the only refusal path, since filled kinds always pass under D-08g), the current custom colour swatch, and up to 5 recent custom colours (most recent first, per browser via `localStorage` key `drawarc:recent-colors`, never synced). Applying any colour uses `updateNodesData(ids, { color })`. No eyedropper. | must | R-031 (03§F-41, F-44), R-062 (skip) | AC-034 |
| FR-024 | `node-color-toolbar.tsx` shall become a properties toolbar (`node-properties-toolbar.tsx`, still one `<NodeToolbar nodeId={selectedIds}>`, D-08b) with groups in order, separated by 1 px dividers: Colour (v1 radiogroup + More) · Border style (`none`/`solid`/`dashed` radiogroup, icons) · Border width (one cycling button 1 → 2 → 3 px, `aria-label="Border width: N px"`) · Text size (`S M L XL` radiogroup) · Bold (toggle, `aria-pressed`) · Align (left/centre/right radiogroup) · Vertical align (top/middle/bottom radiogroup). Each radiogroup uses v1's roving tabindex; Tab moves between groups. For a mixed selection a group shows no checked item and a "—" badge (`aria-label="Mixed"`); the cycling button shows "—" and its next click sets 1 px. Buttons are 24 × 24 px; under 768 px viewport width the toolbar wraps to two rows (`flex-wrap`, max 360 px). Classes `nodrag nopan`, surface as v1. This is the **single properties toolbar for every node kind** (validation ruling 2026-10-28, O-v2-4; F22 ships none): the colour group always renders; the border groups render when every selected kind is one of the six shapes; the text groups render when every selected kind is in F22's `TEXT_OPTION_KINDS` (six shapes, `text`, `sticky`); reserved-kind placeholders get no toolbar (F22 FR-018). | must | R-029 (03§F-31), US-13, D-08b, F22 FR-016 | AC-035, AC-039 |
| FR-025 | Every toolbar action on N selected nodes shall produce exactly one `updateNodesData` call (one change set, one undo step); when the action changes text size or bold, the per-node fitted `height` (FR-017) shall be included in the same change set. | must | R-024 (01§S7), G-9 | AC-036 |
| FR-026 | Dragging a multi-node selection shall remain one undo step for the author (React Flow emits one position change per node per frame; Liveblocks collapses the drag); v2 adds the verification only, no new code. | must | R-024, FR-004 | AC-037 |
| FR-027 | Viewers shall see borders, text options and custom colours rendered exactly as editors do, but no properties toolbar, no resizer and no editor (FR-013 extended). | must | US-14, PRD-012 | AC-038 |

### Non-functional requirements exercised (v2)

| NFR | How v2 meets it |
|---|---|
| NFR-003 | Fit-height is measured once per commit / option change / resize end, never per keystroke; one write per action. |
| NFR-004 | One shared hidden measurer; `fitHeight` runs only on the acting client and, for the resizer `minHeight`, only for selected nodes. Toolbar selectors stay narrow (`useSelectionValue(ids, pick)` generalises `useSelectionColor`). |
| NFR-006 | Derived text colour ≥ 4.58:1 (D-08g proof); selection visible without colour (FR-021); every control has an `aria-label`, radiogroups are keyboard-operable, mixed state is announced. |
| NFR-007 | `data.text` / `data.border` / hex typed from F22's schema v2 types; `fitHeight` and `deriveTextColor` are pure typed functions. |

### UX and interaction behaviour (v2)

- **Shift during resize**: cursor and handles unchanged; the ratio locks to the size at drag start (library `startValues.aspectRatio`), not to the size when Shift was pressed.
- **Auto-grow**: growth is downward only (top edge fixed); the resizer refuses to shrink below the text; no animation; silent clip at 480 px (as v1 clipped at 5 lines).
- **Toolbar while editing**: pointerdown on any toolbar control blurs the textarea → the draft commits (v1 EC-008 rule), then the option applies; Esc in the editor still discards only the draft (D-053).
- **Copy**: tooltips "More colours", "No border" / "Solid" / "Dashed", "Border width: 1 px", "Small", "Medium", "Large", "Extra large", "Bold (Ctrl+B)", "Align left/centre/right", "Align top/middle/bottom"; mixed badge text "—".

### Error handling and edge cases (v2)

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-014 | Shift held before the drag starts and released after it ends; or pressed while the pointer is off the node mid-drag | Ratio applies only between start and end; no box-select starts; selection unchanged | AC-026 |
| EC-015 | Label that fits at width 300 is committed, then the node is resized to width 100 | At resize end the height grows to fit (≤ 480) in the same undo step as the resize | AC-030 |
| EC-016 | 200-character label at `xl` on a 48 px-wide node | Height clamps at 480; label clips; no write above 480; schema (`height ≥ 32`) satisfied | AC-028 |
| EC-017 | Remote user A commits a long label on X while B is idle | Only A writes X's height (A's action); B never emits a height write for X (no phantom undo entry on B) | AC-029 |
| EC-018 | Hex `#FFF`, `fff`, `#FFFFFF`, `#10233d` (blue's fill), `#12345`, `red` | Normalised `#ffffff` ×3; stored as `blue`; `aria-invalid`, not applied; `aria-invalid`, not applied | AC-033, AC-034 |
| EC-019 | Recent-colour list reaches 6 entries; `localStorage` unavailable (private mode) | Oldest dropped (5 kept); storage errors swallowed, list empty, apply still works | AC-034 |
| EC-020 | Text size set to `xl` on 50 selected nodes of different widths | One change set with 50 `replace` items, each with its own fitted height; one undo restores all sizes and heights | AC-036 |
| EC-021 | v1 document (no `data.text`/`data.border`, palette ids) opened after the upgrade | Renders pixel-identical to v1; no write occurs until the user acts | AC-040 |
| EC-022 | Ctrl+B pressed in the editor, then Esc | Nothing written (bold and draft discarded) | AC-041 |
| EC-023 | A sets X's border dashed while B sets X's colour | Per-key LWW (D-014): both land (different keys `border` / `color`); both clients converge ≤ 1 s | AC-040 |
