# F10 — Test Plan

Conventions per `context/testing-strategy.md`; hooks `window.__rf`, `window.__canvasMutations`, `window.__history` (`NEXT_PUBLIC_E2E_HOOKS=1`). Platform is injected into `useKeyboardShortcuts`/`CanvasControls` via a `platform` prop defaulting to detection, so unit tests pass `'mac'`/`'other'` explicitly. Playwright runs with `mod` = `Control` on Linux CI; a second project `webkit-mac` (macOS runner, optional) checks `Meta`.

## Unit cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-006 (pure) | L1 | tests/unit/canvas/shortcuts.test.ts | jsdom elements incl. `[role=dialog]` wrapper | `isEditableTarget` over the listed targets | true/false per AC-006 |
| TC-002 | AC-010 | L1 | tests/unit/canvas/shortcuts.test.ts | synthetic `KeyboardEvent`s | `matchShortcut(e, 'other')` and `(e, 'mac')` for all AC-010 rows | actions as listed; nulls for `Ctrl+-`, `Alt+=` |
| TC-003 | AC-019 (rows) | L1 | tests/unit/canvas/shortcuts-copy.test.ts | `fs.readFileSync('context/ui-context.md')`; parse the table under "## Interaction conventions" | compare with `SHORTCUT_ROWS.slice(0, 10)` | string-identical Action/Input |
| TC-004 | AC-013 | L1 | tests/unit/canvas/duplicate.test.ts | X, Y, Z nodes (X, Y selected, with `selected: true`, `measured`), edges E (X→Y), F (X→Z) | `duplicateSelection([X,Y], [E,F])` | 2 nodes (+20,+20, new ids, cloned data, runtime keys absent); 1 edge X′→Y′ with `e_` id; `idMap` size 2 |
| TC-005 | AC-009, T-002 | L1 | tests/unit/hooks/useCanvasActions.test.tsx | mocked store (`getState` returns selection), mocked mutations, mocked `useRoom().batch` | `deleteSelection()` with/without selection; `duplicateSelection()` | `onDelete` once with `{ nodes, edges }` / not called; `batch` once wrapping `addNodes` + `addEdge`s |
| TC-006 | AC-006 (hook), AC-009, AC-011 | L1 | tests/unit/hooks/useKeyboardShortcuts.test.tsx | `renderHook` with mocked actions, `canEdit` true/false, `platform` | dispatch `keydown` on textarea (Delete), on body (Delete with/without selection, `k`, `mod+d` as viewer), with an open `[role=dialog][data-state=open]` in DOM | not called; called/not called; `defaultPrevented` true for handled, false for `k` and viewer `mod+d`; ignored with open dialog |
| TC-007 | AC-001 | L1 | tests/unit/components/canvas/canvas-controls.test.tsx | mocked `useCanUndo/useCanRedo`; `platform` prop | render for mac and other | order, labels, separator, tooltip strings |
| TC-008 | AC-005 | L1 | tests/unit/components/canvas/canvas-controls.test.tsx | `role="viewer"` | render | 3 buttons, no separator |
| TC-009 | AC-016 | L1 | tests/unit/components/canvas/canvas-context-menu.test.tsx | minimal `<ReactFlow>` with nodes/edges wrapped in `CanvasContextMenu`; mocked actions | `contextmenu` on node / edge / pane; keyboard nav; Escape; remove node from store while open | items per kind; node selected; `ArrowDown`+`Enter` calls delete; closes; closes on removal |
| TC-010 | AC-019 (dialog) | L1 | tests/unit/components/canvas/shortcut-cheat-sheet.test.tsx | render open dialog for editor and viewer | count rows and titles | all rows; viewer rows omitted as listed |
| TC-011 | AC-015, AC-008 (prop-snapshot reference-bug guard, T-007) | L1 | tests/unit/components/flow-canvas.test.tsx (F06 file, new case) | render island with mocked providers; capture `<ReactFlow>` props | assert | `deleteKeyCode === null`, `selectionOnDrag === true`, `selectionMode === 'partial'`, `panOnDrag` deep-equals `[1, 2]`, `connectionMode === 'loose'` |

## End-to-end cases (`tests/e2e/canvas/10-ergonomics.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-012 | AC-002 | L3 | editor; 1280×800 then 700×800 | read control bar and palette boxes | geometry per AC-002; no intersection |
| TC-013 | AC-003 | L3 | 3 nodes | click Zoom in; read zoom at 100 ms and 300 ms; Zoom out; Fit view; keys `+`, `=`, `-`, `Shift+1` | animated, clamped, fitted (all nodes within viewport minus 20 %), key parity |
| TC-014 | AC-004 | L3 | fresh room | read button states; add node; Undo; reload | disabled/disabled → enabled/disabled → enabled/enabled → disabled/disabled |
| TC-015 | AC-007 | L3 | selected node; open share dialog (F12) or cheat-sheet | press Delete/Ctrl+Z/+/? with focus on dialog input and close button; Escape | node intact; zoom same; one dialog only; Escape closes dialog only |
| TC-016 | AC-012 | L3 | one node | click node; ArrowRight; click pane; Escape | node +10 px; selection cleared |
| TC-017 | AC-015 | L3 | 3 nodes | box drag; Shift+box; mod+click twice; middle-drag; right-drag; Space+drag on node; pane click | selections and viewport per AC-015 |
| TC-018 | AC-017 | L3 | — | right-press, move 60 px, release; right-click still | no menu + viewport moved; menu opens |
| TC-019 | AC-018 | L3 | — | right-click at (w−4, h−4) | menu box within viewport |
| TC-020 | AC-020 | L3 | — | press `?`; check focus trap (Tab cycles inside); Escape; focus restored; open via pane menu | dialog behaviour per AC-020 |
| TC-021 | AC-022 | L3 | — | add node; Undo; move another node; read Redo; press mod+shift+z | Redo disabled; no change |

## Collaboration and concurrency cases (`tests/e2e/canvas/10-ergonomics-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-022 | AC-008 | L3 | A, B editors; X, Y, E (sel), F | A presses Delete; A Undo; repeat with Backspace | both: X, E, F gone ≤ 1 s, Y stays; restored after Undo; record latency |
| TC-023 | AC-014 | L3 | A, B; X, Y selected + E | A mod+d; A Undo; A mod+d with nothing selected | 4 nodes/2 edges on both; copies selected on A; Undo removes 3 items; no-op |
| TC-024 | AC-021 | L3 | A owner, B viewer | B: click node, Delete, mod+z, mod+d, mod+a, right-click node, right-click pane, `+`, `-`, `Shift+1`, `?` | nothing selected on B; A unchanged; node menu absent; pane menu 2 items (Fit view, Keyboard shortcuts); navigation keys work |
| TC-025 | AC-023 | L3 | A, B; X at P0 | A moves X→P1; B moves X→P2; A mod+z | both X at P0 ≤ 2 s; B's `__history.canUndo` unchanged; no console errors (documented no-rebase outcome) |
| TC-026 | AC-023 (testing-strategy "User A undoes while B has since moved the same node") | L3 | same as TC-025 | same steps | same expectation — this is the canonical case named in testing-strategy.md |
| TC-027 | AC-008 (testing-strategy "Delete node with edges while B edits label") | L3 | A, B; X with edges; B editing X's label | A Delete | B editor closes; no orphan edges (cross-check F08 TC-020, F09 TC-023) |
| TC-028 | AC-024 | Manual | preview | control bar, context menus, tooltips | screenshots at rest/disabled/menu open | tokens match ui-context; dimmed-but-legible disabled; red destructive item; tooltip after ~300 ms; paths in status.md |

## AUTHZ-MATRIX

Not applicable — no new route or Server Action. Viewer write rejection is F05's; TC-024 covers the UI no-ops.

## Not tested automatically (and why)

- Visual styling of the bar, menu, tooltips (AC-024) — manual.
- `Meta` modifier on real macOS — optional `webkit-mac` Playwright project; Linux CI uses `Control` (both are accepted by `matchShortcut`, and TC-002 covers the mapping).
- Pinch-zoom and ⌘/Ctrl+scroll — React Flow built-ins; smoke-checked manually.
- Redo-stack clearing is asserted behaviourally (TC-021) because the Liveblocks docs fetched do not state it explicitly.

## v2 — canvas productivity (2026-10-28)

Lean budget (testing-strategy "Test budget"): one unit file per pure module (registry, clipboard, align, preferences), the two existing hook/component test files extended rather than duplicated, one single-user and one two-user e2e spec. No per-button render tests; menu/bar enumeration is covered by AC-026's single attribute sweep.

### Unit cases (v2)

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-029 | AC-025 | L1 | tests/unit/canvas/registry.test.ts | `SHORTCUTS`, `RESERVED_CHORDS`; a cloned registry with `mod+c` added twice | flatten chords; run the checker; `formatKeys` for v1 actions; `ariaKeyShortcuts('redo')` | unique set; checker throws on the clone; v1 strings identical; W3C string |
| TC-030 | AC-027 (pure) | L1 | tests/unit/canvas/registry.test.ts | synthetic `KeyboardEvent`s | `matchShortcut` for letters, `Ctrl+R`, `Alt+H`, `Shift+R`, `t`, `n`, `mod+'` (`code: 'Quote'`), `Shift+Digit2`, `mod+shift+ArrowLeft` | `insert*`; nulls; `toggleGrid`; `zoomToSelection`; `alignLeft` |
| TC-031 | AC-027 (hook) | L1 | tests/unit/hooks/useKeyboardShortcuts.test.tsx (extended) | mocked actions; pointer ref at (400, 300) / null; `canEdit` true/false; a focused `.react-flow__node` whose own `keydown` handler calls `preventDefault` | press `r`; press `mod+shift+ArrowLeft` on the node | `insertShape('rectangle')` once + prevented; viewer: nothing; align called although the node handler ran (capture) and `stopPropagation` observed |
| TC-032 | AC-030 | L1 | tests/unit/canvas/clipboard.test.ts | envelope N1, N2, E1, E2(ghost); 1 000 001-char string; `hello`; v1 envelope | `placePasted` twice; `parseClipboardText` × 3 | per AC-030 (ids, offset, centre, dropped edge, disjoint ids; `none`/`text`/`envelope`) |
| TC-033 | AC-029 | L1 | tests/unit/canvas/clipboard.test.ts + useCanvasActions.test.tsx | `navigator.clipboard` undefined → defined with rejecting `readText` | `writeClipboardText`; `copy()`; menu `paste()` | memory holds text; no throw; paste uses memory; empty → no `addNodes` |
| TC-034 | AC-031 | L1 | tests/unit/hooks/useCanvasActions.test.tsx (extended) | mocked store/mutations; four invalid texts | `paste(text)` | no mutation calls; selection untouched |
| TC-035 | AC-033 | L1 | tests/unit/hooks/useCanvasActions.test.tsx (extended) | `vi.mock('@/lib/canvas/kinds')` with/without `'text'`; mocked `addNodeOfKind` | `paste('plain words')` | nothing / `addNodeOfKind('text', pointer, { label: 'plain words' })` once |
| TC-036 | AC-036 | L1 | tests/unit/canvas/align.test.ts | boxes A, B, C(locked), D | all six `alignNodes` modes; `distributeNodes` h/v; degenerate inputs | positions per AC-036; `[]` cases |
| TC-037 | AC-035 | L1 | tests/unit/canvas/preferences.test.ts + canvas-controls.test.tsx | `localStorage.getItem` stubbed to throw; viewer props | `get`, `set(true)`, `get`; render bar | false → true; Grid toggle present for viewer |
| TC-038 | AC-026 | L1 | tests/unit/components/canvas/canvas-controls.test.tsx + canvas-context-menu.test.tsx | editor render, platform `other` | query every `[aria-keyshortcuts]` and hint | equals `ariaKeyShortcuts`/`formatKeys` for its action; bar order Zoom out · readout · Zoom in · Fit · Grid · sep · Undo · Redo |

### End-to-end cases (`tests/e2e/canvas/10-productivity.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-039 | AC-034 | L3 | editor; node at (33, 47) | `mod+'`; drag node +10/+10; read `__rf` props/positions; reload; toggle via button | snap props on; position multiple of 20; persisted; dots restored |
| TC-040 | AC-039 | L3 | 5 nodes, 2 selected far apart | `Shift+2`; clear selection; `Shift+2`; pane menu item | selection fully visible, an unselected node off-screen; equals fit; same via menu |
| TC-041 | AC-040 | L3 | — | read readout; Zoom in; click readout; `__rf.zoomTo(4)`; `zoomTo(0.1)` | `100 %` → changed → `100 %`/zoom 1; disabled states and `400 %`/`10 %` |
| TC-042 | AC-041 | L3 | room with nodes | click, box-select, zoom, pan, grid toggle, `?` open/close; start drag, `mod+Z` mid-drag, finish | Undo disabled throughout; mid-drag undo ignored |

### Collaboration and concurrency cases (`tests/e2e/canvas/10-productivity-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-043 | AC-028 | L3 | A, B; X, Y selected, E, F | A `mod+X`; A Undo | 4 items gone on both ≤ 1 s; restored by one Undo; memory envelope intact (via `__clipboard` hook) |
| TC-044 | AC-032 | L3 | A, B; X, Y, E copied | A pointer (600, 400), `mod+V`; pointer over sidebar, `mod+V`; A opens a second project tab, `mod+V` | centre within 2 px; viewport centre; works across tabs; copies selected; one Undo |
| TC-045 | AC-037, AC-038 | L3 | A, B; 3 nodes selected, one focused | A `mod+shift+ArrowLeft`; A Undo; toolbar/menu "Align centre"; "Distribute horizontally" | left edges equal on both, y unchanged; restored; centre/distribute per AC |
| TC-046 | AC-042 | L3 | A, B | A add node, Undo; B moves another node; A `mod+shift+Z` | A Redo enabled; node re-added on both |
| TC-047 | AC-043 | Manual | preview | grid on, readout at several zooms, 3-node selection, Align submenu by keyboard | screenshots in status.md |

### AUTHZ-MATRIX

Not applicable — no new route or Server Action. Viewer no-ops for paste/cut/align/insert are covered by TC-031 (hook, `canEdit: false`); the `*:read` token remains the authority (F05).

### Not tested automatically (and why)

- Real OS clipboard permission prompts (Firefox `readText`, Safari gesture rules) — Playwright grants clipboard permissions in Chromium only; the memory fallback path is unit-tested (TC-033) and the e2e uses Chromium.
- Grid line rendering and readout width stability — manual (TC-047).
- "System writes create no undo entries" (FR-025, F13/F14) — verified by inspection: F13 restore and F14 import write through the server/REST path or the importer's own client only, so no other client's Liveblocks history receives an entry; no new test.
