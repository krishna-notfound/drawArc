# F09 — Test Plan

Conventions per `context/testing-strategy.md`; test hooks `window.__rf`, `window.__canvasMutations`, `window.__history` (`NEXT_PUBLIC_E2E_HOOKS=1`). Handle drag helper for Playwright: `dragHandle(page, nodeId, handleId, toNodeId, toHandleId)` in `tests/e2e/helpers/canvas.ts` (shared with F07/F10), which hovers the node first so handles become interactive (opacity is irrelevant to hit-testing; the helper exists for stability).

## Unit and integration cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-006 | L1 | tests/unit/canvas/connections.test.ts | none | `buildEdge` with valid connection; with `sourceHandle: null` | exact key set, `type`, `data: {}`, id regex; throws |
| TC-002 | AC-007 | L1 | tests/unit/canvas/connections.test.ts | edges `[a.right→b.left]` | five `isValidConnection` cases from AC-007 | false, false, true, true, true |
| TC-003 | AC-010 | L1 | tests/unit/hooks/useCanvasConnections.test.tsx | `renderHook` with mocked mutations and store containing E | `onReconnectStart(E)`; `onReconnect(E, same)`; `onReconnectEnd(E)` | `replaceEdge` and `onDelete` not called |
| TC-004 | AC-011 | L1 | tests/unit/hooks/useCanvasConnections.test.tsx | as TC-003 plus edge F = X.right→Z.top | (i) start→end only; (ii) start→reconnect(E, X.right→Z.bottom)→end; (iii) start→reconnect(E, X.right→Z.top)→end | (i) `onDelete` once with `[E]`; (ii) `replaceEdge` once, keeps id/data, no delete; (iii) neither called — a rejected reconnect (duplicate of F) still marks the gesture as handled (the ref is set on any `onReconnect` call), so `onReconnectEnd` must not delete E |
| TC-005 | AC-001 | L1 | tests/unit/components/canvas/canvas-edge.test.tsx | import module; render island twice | `Object.isFrozen(edgeTypes)`, `$$typeof`; captured `<ReactFlow>` props across re-renders | frozen single key; memo; same `edgeTypes` and `defaultEdgeOptions` references; deep-equal to FR-001 |
| TC-006 | AC-002, AC-003 | L1 | tests/unit/components/canvas/canvas-edge.test.tsx | two nodes + one edge in minimal `<ReactFlow defaultEdgeOptions>` | inspect `path[marker-end]`, `<marker>` polygon fill, `d` vs `getSmoothStepPath`, interaction path width, computed styles; render fixture with missing `sourceHandle` | marker fill `#f8fafc`; `d` equal; 20; `0.6/1.5/round`; no throw |
| TC-007 | AC-014 | L1 | tests/unit/components/canvas/canvas-edge.test.tsx | three edges (labelled, selected-unlabelled, plain) | query label layer | badge "HTTPS" with classes; hint text and colour; nothing; badge transform equals `labelX/labelY` |
| TC-008 | AC-017 | L1 | tests/unit/components/canvas/canvas-edge.test.tsx | nodes "API"/unlabelled cylinder; edge "SQL" | read `aria-label` | "edge from API to cylinder, labelled SQL" |
| TC-009 | AC-012 | L1 | tests/unit/components/canvas/edge-label-editor.test.tsx | labelled edge, `canEdit` | dblclick badge; type 30 chars | input attrs/classes, selection, width 5ch → 24ch; container `pointer-events: all` |
| TC-010 | AC-013 | L1 | tests/unit/components/canvas/edge-label-editor.test.tsx | mocked `updateEdgeData`; window keydown recorder | Enter "events"; Escape after typing; blur unchanged; blur ""; paste 500 chars with `\n`; press Backspace/Delete/+/Ctrl+Z; unmount while open | one call; none; none; `{ label: undefined }`; length 100 no `\n`; recorder empty; no call |
| TC-011 | AC-005, AC-015 (T-001 spike precondition, kept as regression) | L2 | tests/integration/liveblocks/flow-edge-changes.test.tsx | two clients, dev server | add edge; replace edge; check `defaultEdgeOptions` effect via rendered `type`; delete node with edges; `canUndo` transitions | client 2 sees each ≤ 2 s; one undo entry for the node+edges delete |

## End-to-end cases (`tests/e2e/canvas/09-edges.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-012 | AC-004 | L3 | one edge | hover; click; click pane; read computed styles | 1; 1 & 2px; 0.6 & 1.5px |
| TC-013 | AC-005 | L3 | X, Y 400 px apart | 16 × (`dragHandle`, read `__rf.getEdges()`, delete edge via `__canvasMutations.onDelete`) | one edge per run with correct handles/type/data/id **(reference bug §3)** |
| TC-014 | AC-008 | L3 | X, Y | release over pane; over sidebar; over X.bottom | 0 edges; `__history.canUndo` false |
| TC-015 | AC-019 | L3 | X, Y, Z | connect; reconnect to Z; label "events"; delete; undo ×4 with state read after each | each undo reverts one action; initial state after four |
| TC-016 | AC-017 (Tab) | L3 | 2 nodes, 1 edge | Tab from last node | edge element focused |

## Collaboration and concurrency cases (`tests/e2e/canvas/09-edges-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-017 | AC-009 | L3 | A, B editors; E, Z | A drags E's target end to Z.top | B sees same id with `target: Z`, `targetHandle: 'top'` ≤ 1 s; record latency |
| TC-018 | AC-015 | L3 | A, B; X with 3 edges + 2 unrelated | A `onDelete({ nodes:[X] })`; A undo | both: 2 edges then 5 edges + X restored ≤ 1 s each |
| TC-019 | AC-016 | L3 | A, B; selected E | A `onDelete({ nodes:[], edges:[E] })`; undo | removed then restored (same id/label) on both |
| TC-020 | AC-018 | L3 | A owner, B viewer | B hovers node; drags from handle; dblclicks edge; clicks edge; `__canvasMutations.addEdge` | handle opacity 0; 0 new edges; no input; edge not `.selected`, no reconnect anchor (`.react-flow__edgeupdater` absent); A unchanged |
| TC-021 | AC-020 | L3 | A, B | B starts dragging Y (300 px, 20 steps) while A connects X→Y | edge end at Y's final position on both ≤ 2 s; `getEdges()` equal |
| TC-022 | AC-021 | L3 | A, B | both connect X.right→Y.left within 200 ms | 2 edges, distinct ids, no errors; deleting one leaves one |
| TC-023 | AC-015 (testing-strategy "Delete node with edges while B edits its label") | L3 | A, B | B opens label editor on X (F08); A deletes X | B editor closes; 0 orphan edges on both (cross-check with F08 TC-020) |
| TC-024 | AC-022 | Manual | preview | edges at zoom 0.5, 1, 2; one labelled, one selected-unlabelled | screenshot | arrowhead at target handle, hover/selection brightness, badge and hint legibility; screenshot path in status.md |

## AUTHZ-MATRIX

Not applicable — no new routes/actions; room-level enforcement is F05's matrix. TC-020 covers the UI gate.

## Not tested automatically (and why)

- Visual quality of arrowheads, hover brightness, badge legibility (AC-022) — manual screenshots.
- Keyboard-only edge creation — not supported by React Flow; recorded as a known NFR-006 limitation.
- 800-edge drag performance (EC-010) — covered by F15's scripted perf test, not duplicated here.
