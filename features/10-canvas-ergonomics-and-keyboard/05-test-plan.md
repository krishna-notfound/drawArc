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
