# F08 — Test Plan

Conventions as in `context/testing-strategy.md`. L3 uses the Liveblocks dev server and two Clerk test users; `window.__rf`, `window.__canvasMutations`, `window.__history` are `NEXT_PUBLIC_E2E_HOOKS=1` test hooks. Fixtures: `tests/fixtures/canvas/small-5-nodes.json` (seeded via the F13 snapshot API when available, else created through the palette in `beforeEach`).

## Unit and integration cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | tests/unit/components/canvas/node-resizer.test.tsx | render one rectangle via minimal `<ReactFlow>`; toggle `selected` | query `.react-flow__resize-control` | 12 controls when selected (8 handles, 4 lines); 0 when not |
| TC-002 | AC-002 | L1 | tests/unit/components/canvas/node-resizer.test.tsx | `vi.mock('@xyflow/react')` partial to spy `NodeResizer` props | render circle/pill selected, and rectangle selected with `canEdit=false` | `keepAspectRatio` true/false; `minWidth 48`, `minHeight 32`; `isVisible` false for viewer |
| TC-003 | AC-008 | L1 | tests/unit/components/canvas/node-label-editor.test.tsx | node with label "API", `canEdit` | `dblclick` body | textarea with attributes/classes per FR-006; value "API"; `selectionStart 0`, `selectionEnd 3`; focused; node `selected` unchanged |
| TC-004 | AC-009 | L1 | tests/unit/components/canvas/node-label-editor.test.tsx | focus node root | press Enter (canEdit true), then same with canEdit false; dblclick with canEdit false | opens; does not open; does not open |
| TC-005 | AC-010 | L1 | tests/unit/components/canvas/node-label-editor.test.tsx | mocked `updateNodeData` | type "Gateway" + Enter; reopen, Enter with no change; type, Shift+Enter; type, blur | one call `{ label: 'Gateway' }`, closed, node focused; no call; newline present, still open; one call on blur |
| TC-006 | AC-011 | L1 | tests/unit/components/canvas/node-label-editor.test.tsx | as TC-005 | type then Escape; paste 1 000 chars then Enter | no call, original label, node focused; value length 200, commit length ≤ 200 |
| TC-007 | AC-013 | L1 | tests/unit/components/canvas/node-label.test.tsx | label '' | read placeholder text/style; open+close editor; compare label box | "Double-click to label", `--text-faint`, `user-select: none`; `aria-label` "… unlabelled"; same `getBoundingClientRect` |
| TC-008 | AC-020 | L1 | tests/unit/components/canvas/node-label.test.tsx | label with 20 lines | computed styles of label and textarea | `-webkit-line-clamp: 5`, overflow hidden; identical font-family/size/line-height/padding |
| TC-009 | AC-015 | L1 | tests/unit/components/canvas/node-color-toolbar.test.tsx | store with one selected blue node; `canEdit` | render toolbar; then with no selection; then `canEdit=false` | radiogroup, 8 radios in order, labels, `aria-checked` on blue + Check icon; absent; absent |
| TC-010 | AC-018 (keyboard) | L1 | tests/unit/components/canvas/node-color-toolbar.test.tsx | as TC-009 | ArrowRight ×8, End, Home, Space | wraps to start; teal; neutral; `updateNodesData([id], { color: 'neutral' })` called |
| TC-011 | AC-017 (unit half of the batched mutation) | L1 | tests/unit/hooks/useCanvasMutations.test.tsx | mocked hook + `useRoom().batch` spy | `updateNodesData([a,b,c], { color: 'green' })` | `batch` called once; inside it one `onNodesChange` with three `replace` changes, each `data` a new object with `color: 'green'` |
| TC-012 | T-001 spike (AC-003/006/017 precondition) | L2 | tests/integration/liveblocks/flow-resize-and-batch.test.tsx | two clients on the dev server | client 1 emits a dimension change sequence (resizing true… false); client 1 then batches 3 replaces; check `canUndo` transitions | client 2 sees final width/height; exactly one undo entry per gesture and one for the batch |

## End-to-end cases (`tests/e2e/canvas/08-node-editing.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-013 | AC-003 | L3 | A editor; one 180×80 rectangle | select; drag bottom-right handle (+60,+40); read DOM box and `__rf.getNode`; drag top-left (−20,−10) | 240×120 both; then 260×130 and position shifted (−20,−10) |
| TC-014 | AC-005 | L3 | 60×40 rectangle; 96×96 circle | drag below min; drag circle right handle +50 | 48×32 exactly; 146×146 |
| TC-015 | AC-006 | L3 | one node | resize gesture; drag 100 px; `__history.canUndo`; undo ×2 | position restored first, size second |
| TC-016 | AC-012 | L3 | node with label; window + pane `keydown` recorders installed | open editor; press Backspace, Delete, ArrowLeft, +, -, ?, Ctrl+Z, Ctrl+A; wheel over textarea | recorders empty; node exists at same position; zoom unchanged |
| TC-017 | AC-017 | L3 | 3 nodes (neutral, blue, blue) | box-select all; click green swatch; undo | all green on A; one undo restores all three |
| TC-018 | AC-018 (drag half) | L3 | selected node | `mouse.down` on toolbar background, move 30 px, up | node position unchanged |

## Collaboration and concurrency cases (`tests/e2e/canvas/08-node-editing-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-019 | AC-004 | L3 | A, B editors | A resizes to 240×120 | B DOM and `getNode` 240×120 ≤ 1 s |
| TC-020 | AC-014 | L3 | A, B editors; node X | B opens editor on X and types; A deletes X (F10 Delete or `__canvasMutations.onDelete`) | B's textarea gone ≤ 1 s; no B write for X; X absent on both; no console errors on B (`page.on('console')`) |
| TC-021 | AC-019 | L3 | A owner, B viewer | B clicks node; dblclick; Enter; `__canvasMutations.updateNodeData(id,{label:'x'})` | node not `.selected`; no resizer/toolbar/editor; A unchanged after 2 s |
| TC-022 | AC-021 | L3 | A, B editors | both open editor on X; A Enter "alpha"; 50 ms later B Enter "beta" | both render "beta" ≤ 2 s; no errors |
| TC-023 | AC-022 | L3 | A, B editors | simultaneous drags of X to (400,400) and (800,200) | identical position on both ≤ 2 s |
| TC-024 | AC-023 | L3 | A, B editors | A resize 240×120; B resize 300×150; A undo | both 180×80 ≤ 2 s; no errors (documented no-rebase outcome) |
| TC-025 | AC-024 | L3 | A, B editors | B offline; A commits label; B offline-commits another node's label; B online | both labels on both clients ≤ 5 s after reconnect |
| TC-026 | AC-017, AC-021 (testing-strategy "Two users edit different nodes") | L3 | A, B editors | A recolours X, B relabels Y simultaneously | both changes on both ≤ 1 s |
| TC-027 | AC-007 | Manual | preview | selected node at zoom 1 and 2 | screenshot handles | 8 × 8 px brand handles, lines at 60 %; screenshot path in status.md |
| TC-028 | AC-016 | Manual | preview | single and multi-selection at zoom 1 and 2 | screenshot toolbar | 12 px above the node, no overlap, 20 px swatches at both zooms; screenshot path in status.md |

## AUTHZ-MATRIX

Not applicable — no new route or Server Action. Viewer write rejection at the room boundary is F05's matrix; TC-021 covers the UI gate.

## Not tested automatically (and why)

- Visual quality of resize handles, toolbar placement and glow (AC-007, AC-016) — manual screenshots.
- Role downgrade mid-edit (EC-010) — the downgrade flow belongs to F12; here the unit test for the editor's `canEdit` prop flipping to false (editor closes without commit) is included in TC-004's file as an extra case, but the end-to-end KICK path is tested in F12.
- Touch double-tap to open the editor — manual on a device; Playwright touch emulation smoke only.

---

## v2 — richer node editing (2026-10-28)

Lean budget (testing-strategy "Test budget"): one unit file per pure helper, extensions of the existing component/E2E files, no per-control tests. `window.__rfChanges` (new hook, T-013) records every `onNodesChange` call for change-count assertions.

### Unit and integration cases (v2)

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-029 | AC-028 | L1 | tests/unit/canvas/fit-height.test.ts | `measureText` stubbed | call `fitHeight` with content 40 / 20 / 2 000, border 1 and 3, widths 180 and 48 | 58; current height (no shrink); 480; mirror width = w − 16 − 2·border |
| TC-030 | AC-031, AC-041 | L1 | tests/unit/components/node-label-editor.test.tsx | nodes with and without `data.text`; mocked `replaceNode` | read computed styles at rest and in the editor; Ctrl+B + Enter; Ctrl+B + Escape; click toolbar stub while editing | xl/600/left/flex-end and v1 defaults; one call with `text.bold`; no call; commit call then option call |
| TC-031 | AC-032 | L1 | tests/unit/components/canvas/shape-renderer.test.tsx | rectangle + hexagon, `border` variants, selected on/off | inspect `border` style / polygon attributes | per FR-021 table, `none`→solid brand when selected |
| TC-032 | AC-033 | L1 | tests/unit/canvas/color.test.ts (extend F22's) | seeded PRNG, 1 000 hexes | `normaliseColor`, `resolveColor`, contrast | normalisation/palette-id cases; every pair ≥ 4.58; `textContrastOk` true for filled kinds, false for kind `text` + `#111114` |
| TC-033 | AC-034, AC-035 | L1 | tests/unit/components/node-color-toolbar.test.tsx (extend) | store with 1 then 2 selected nodes (mixed border); `localStorage` mock, then throwing mock | More colours → hex input flows; six applies; text-kind refusal; mixed rendering incl. rectangle+sticky and frame cases; Tab/arrow traversal | per AC-034/035; storage failure swallowed |
| TC-034 | AC-036 (unit half) | L1 | tests/unit/hooks/useCanvasMutations.test.tsx (extend) | 3 nodes | `updateNodesData(ids, patchFn)` | one `triggerNodeChanges` call with 3 `replace` items carrying distinct `height`s |
| TC-035 | AC-030 (prop half), T-008 | L1 + L2 | tests/unit/components/canvas/node-resizer.test.tsx; tests/integration/liveblocks/flow-resize-and-batch.test.tsx (extend) | `NodeResizer` mocked for props; dev server for the spike | emit `onResize` with `sourceEvent.shiftKey`; measure `minHeight`; spike (a)(b)(c) | `keepAspectRatio` follows Shift; `minHeight` ≥ fit; spike results recorded in status.md |

### End-to-end cases (`tests/e2e/node-editing.spec.ts`, extend)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-036 | AC-025, AC-026 | L3 | hexagon 160 × 110; F10 merged | drag with Shift mid-drag; Shift held across the whole gesture; Shift+drag on pane | 240 × 165; no selection box; box-select intact |
| TC-037 | AC-027 (P3) | L3 | rectangle at (100,100) | Alt-drag right handle +40; undo | 260 × 80 at (60,100); restored in one undo |
| TC-038 | AC-030 | L3 | node with long label at width 300 | resize to width 100; release; undo | height = fitted; one undo restores width + height (or two — recorded) |
| TC-039 | AC-036, AC-037 | L3 | 3 nodes, widths 180/100/60 | box-select; XL; undo; drag all by (120,60); undo | one change set; distinct heights; one undo each |

### Collaboration cases (`tests/e2e/node-editing-collab.spec.ts`, extend — mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-040 | AC-029 | L3 | A, B editors; `__rfChanges` on both | A commits a 6-line label | A: one `replace` with new height; undo restores both; B: zero changes for X |
| TC-041 | AC-038 | L3 | A owner, B viewer | A sets border/text/hex; B inspects; B calls `updateNodesData` | identical computed styles on B; no toolbar; A unchanged after 2 s |
| TC-042 | AC-040 | L3 | A, B editors; v1 fixture | A dashed + B hex within 100 ms; load v1 fixture | both land ≤ 1 s; v1 styles identical; no change emitted for 2 s |
| TC-043 | AC-039 | Manual | preview | zoom 0.5/1/2; viewport 1280 and 700 px | screenshots in status.md |

### Not tested automatically (and why)

- Visual legibility of dashed borders and toolbar layout (AC-039) — manual screenshots.
- Alt-from-centre (TC-037) exists only if FR-016 is approved.
- Font rendering differences across OSes in `measureText` — F22 owns the mirror; F08 tests stub it (TC-029) and rely on F22's AC for pixel accuracy.
