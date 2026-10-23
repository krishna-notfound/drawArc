# F07 — Test Plan

Layers and commands per `context/testing-strategy.md`. L3 runs against the Liveblocks dev server (`npx liveblocks dev --no-persist`, port 1153) with two Clerk test users (A editor/owner, B editor or viewer as stated), one project per test created via the F03 API in `beforeEach`. `window.__rf` (React Flow instance) and `window.__canvasMutations` are test-only hooks (`NEXT_PUBLIC_E2E_HOOKS=1`).

## Unit and integration cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-007 | L1 | tests/unit/canvas/drop-position.test.ts | none | call `centredDropPosition` with (100,200)/180×80 and (100,200)/96×96; property test: 200 random points and the six `DEFAULT_SIZES` | (10,160); (52,152); `result + size/2 === point` for all |
| TC-002 | AC-022 | L1 | tests/unit/canvas/ids.test.ts | none | 10 000 × `newNodeId('pill')`, 1 000 × `newEdgeId()` | regex matches; `new Set(ids).size === ids.length` |
| TC-003 | AC-009 | L1 | tests/unit/hooks/useCanvasMutations.test.tsx | `renderHook` with mocked F06 hook output (`onNodesChange` = `vi.fn()`), `canEdit: true` | `addNode` for each of the six shapes | each emitted `item` deep-equals the FR-005 shape with `DEFAULT_SIZES[shape]`; exactly one `add` change then one `select` change |
| TC-004 | AC-009 (viewer branch), AC-020 (unit half) | L1 | tests/unit/hooks/useCanvasMutations.test.tsx | `canEdit: false` | `addNode('circle', {x:0,y:0})` | returns `null`; `onNodesChange` not called |
| TC-005 | AC-003 | L1 | tests/unit/hooks/useShapeDrag.test.tsx | jsdom; `HTMLElement.prototype.setPointerCapture/releasePointerCapture` mocked; `useReactFlow` mocked (`getZoom: () => 1`) | `pointerdown` (button 0) → `pointermove` +3 px → assert → `pointermove` +4 px → assert; repeat with button 2 | no ghost at 3 px; ghost + `setPointerCapture(pointerId)` at 4 px; nothing with button 2 |
| TC-006 | AC-005 | L1 | tests/unit/hooks/useShapeDrag.test.tsx | as TC-005; `document.elementFromPoint` mocked to return an element inside a `.react-flow__pane` fixture; `screenToFlowPosition` mocked identity | drag ≥ 4 px → `pointerup` at (300,200) with shape `rectangle` | `onDrop('rectangle', {x:300,y:200})` called once; then `addNode` path emits `add` then `select` (via mocked mutations) |
| TC-007 | AC-006 | L1 | tests/unit/hooks/useShapeDrag.test.tsx | as TC-006; four cases | (a) `elementFromPoint` returns sidebar element on `pointerup`; (b) `pointercancel`; (c) `keydown Escape` on document; (d) `window.dispatchEvent(new Event('blur'))` | ghost removed; `releasePointerCapture` called; `onDrop` never called in all four |
| TC-008 | AC-001 | L1 | tests/unit/components/canvas/shape-palette.test.tsx | render `<ShapePalette role="editor">` inside `TooltipProvider` + mocked provider | query `role="toolbar"`, buttons; hover first button | six buttons with exact `aria-label`s in order; tooltip text "Rectangle — drag onto canvas, or press Enter" |
| TC-009 | AC-014 | L1 | tests/unit/components/canvas/canvas-node.test.tsx | render `CanvasNode` via a minimal `<ReactFlow nodes=[…]>` with one node per shape, color `blue` | inspect DOM/computed style; re-render with `width: 300, height: 200` | CSS shapes: no `<svg>`, radii 12px/9999px/50%; SVG shapes: `preserveAspectRatio="none"`, fill `#10233D`; label color `#52A8FF`; svg box 300×200 |
| TC-010 | AC-016 | L1 | tests/unit/components/canvas/canvas-node.test.tsx | as TC-009 | count `.react-flow__handle`; read `data-handleid`, position classes, computed `display/visibility/opacity` | 4 handles, ids top/right/bottom/left, matching classes, none hidden, opacity 0 |
| TC-011 | AC-018 | L1 | tests/unit/components/canvas/canvas-node.test.tsx | import module | check `$$typeof`, `Object.isFrozen(nodeTypes)`, keys; render with label '' and 'API' | memo; frozen `{ canvasNode }`; `aria-label` "rectangle unlabelled" / "rectangle API" |
| TC-012 | AC-019 | L1 | tests/unit/components/canvas/canvas-node.render-count.test.tsx | fixture `tests/fixtures/canvas/large-500-nodes.json`; test-only render counter | emit one `position` change for node 17 | only node 17's `data-render-count` increments |
| TC-013 | T-001 spike (AC-009 precondition) | L2 | tests/integration/liveblocks/flow-add-change.test.tsx | two `createClient`s against the dev server, same room, `useLiveblocksFlow` in each | client 1 emits `add`; client 2 polls `nodes`; client 1 emits `replace` with new `data.label` while client 2 emits `replace` with new `data.color` | client 2 sees the node ≤ 2 s; final `data` has both the new label and the new colour |

## End-to-end cases (`tests/e2e/canvas/07-shapes.spec.ts` unless stated)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-014 | AC-002 | L3 | A editor; viewports 1280×800 and 700×800 | read palette `boundingBox()`; read F10 control bar box if present | centred ±2 px, bottom gap 16 px; 36 px buttons at 700 px; no box intersection |
| TC-015 | AC-004, AC-021 | L3 | A editor, zoom set to 1.5 via `__rf.setViewport` | `page.mouse.down` on `Add hexagon`, move to (400,300) in 5 steps; `page.evaluate` ghost transform, size, `pointerEvents`, and `document.elementFromPoint(400,300).closest('.react-flow__pane')` | ghost centre (400,300) ±0.5; 240×165; `none`; pane element (not ghost) |
| TC-016 | AC-008 | L3 | A editor; two runs: `setViewport({x:-640,y:480,zoom:0.5})` and `zoom:2` | drag rectangle to (500,400); release; read new node `boundingBox()` | centre within 1 px of (500,400) in both runs **(reference bug §4)** |
| TC-017 | AC-011 | L3 | A editor; empty canvas; `setViewport({x:123,y:-45,zoom:1.3})` | drop node; `getViewport()`; drop second node; `getViewport()` | both reads exactly `{123,-45,1.3}` **(reference bug §5)** |
| TC-018 | AC-012, AC-013 | L3 | A editor | Tab to `Add pill`, press Enter; then click `Add circle` without moving | pill centred on container centre ±1 px; circle likewise; new node has `.selected`, others not; `document.activeElement` is the node |
| TC-019 | AC-016 (hover half) | L3 | one node | hover node; read handle `opacity`; move away | 1 on hover, 0 at rest |
| TC-020 | AC-017 | L3 | two nodes | for each of top/right/bottom/left on node 1: drag from handle to node 2's `left` handle | 4 `onConnect` payloads (via `__rf` test hook) with `sourceHandle` = started handle **(reference bug §3)** |

## Collaboration and concurrency cases (`tests/e2e/canvas/07-shapes-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-021 | AC-010 | L3 | A, B editors | A drops diamond; B polls `.react-flow__node` | B sees same `data-id`, transform, width/height ≤ 1 s; B's selection unchanged; record A→B latency for NFR-003 |
| TC-022 | AC-010, AC-022 | L3 | A, B editors | both drop within 200 ms (`Promise.all`) | two nodes, distinct ids, each at its author's position on both clients |
| TC-023 | AC-020 | L3 | A owner, B viewer | B opens workspace; `page.evaluate(() => window.__canvasMutations.addNode('circle',{x:0,y:0}))` | no palette; `null`; A sees no node after 2 s |
| TC-024 | AC-023 | L3 | A, B editors | `B.setOffline(true)`; B drops; wait 2 s; `setOffline(false)` | A sees B's node ≤ 5 s after reconnect |
| TC-025 | AC-010 (testing-strategy "Two users edit different nodes") | L3 | A, B editors, two nodes | A moves node 1, B moves node 2 simultaneously | both see both moves ≤ 1 s (regression guard for the node component) |
| TC-026 | AC-015 | Manual | preview `/editor/[id]` | A editor | drop all six shapes; select one; screenshot | selected 2 px brand border, rest 1 px default border; screenshot path recorded in status.md |

## AUTHZ-MATRIX

Not applicable — F07 adds no route or Server Action. Viewer enforcement at the room boundary is covered by F05's Liveblocks auth matrix (`*:read` for viewers); TC-023 covers the UI side.

## Not tested automatically (and why)

- Visual fidelity of the six shapes and border/hover styling (AC-015) — manual screenshot review; pixel-diffing is not in the toolchain.
- Touch drag on a physical device — Playwright's touch emulation is used for a smoke run in TC-015 (`hasTouch: true` context), but real-device behaviour is checked manually before milestone sign-off.
- `prefers-reduced-motion` ghost transitions — manual check.
