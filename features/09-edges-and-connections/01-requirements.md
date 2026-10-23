# F09 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The canvas shall register `edgeTypes = { canvasEdge: CanvasEdge }` (module constant) and `defaultEdgeOptions = { type: 'canvasEdge', markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: EDGE_STROKE } }` (memoised) on `<ReactFlow>`; every rendered edge uses the custom component and shows a closed arrowhead at its target end. | must | PRD-026 | AC-001, AC-002 |
| FR-002 | `CanvasEdge` shall compute its path with `getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 8 })` and render `<BaseEdge path interactionWidth={20} markerEnd>`; stroke `EDGE_STROKE` at 60 % opacity, width 1.5 px, `stroke-linecap: round` at rest; 100 % opacity on hover; 100 % opacity and width 2 px when `selected`. | must | PRD-026 | AC-003, AC-004 |
| FR-003 | Completing a connection gesture between two **different** nodes shall create exactly one edge `{ id: newEdgeId(), source, target, sourceHandle, targetHandle, type: 'canvasEdge', data: {} }` via `useCanvasMutations().addEdge` (→ `onEdgesChange([{ type: 'add', item }])`), where `sourceHandle`/`targetHandle` are the handle ids the gesture started and ended on. All 16 (sourceHandle × targetHandle) combinations shall work. **(reference bug §3)** | must | PRD-025, US-1, D-09a | AC-005, AC-006 |
| FR-004 | `isValidConnection` on `<ReactFlow>` shall return `false` when `source === target` or when an edge with the same `(source, sourceHandle, target, targetHandle)` already exists; React Flow then shows the invalid state and `onConnect` is never called for it. A connection released over the pane (no handle) shall create nothing. | must | PRD-025, US-2, D-09d | AC-007, AC-008 |
| FR-005 | Edges shall be reconnectable for editors (`edgesReconnectable={canEdit}`, `onReconnect`, `reconnectRadius` default 10): dragging an edge end to a different valid handle shall emit one `replace` change keeping the edge `id` and `data` and updating the moved endpoint/handle; dragging to the same handle pair shall emit nothing; releasing on empty space shall delete the edge via `onDelete({ nodes: [], edges: [edge] })`. | must | PRD-025, US-3, D-09b | AC-009, AC-010, AC-011 |
| FR-006 | Double-clicking an edge (path, hit area, or its badge) shall open an inline label input at `(labelX, labelY)` inside `<EdgeLabelRenderer>` with `pointerEvents: 'all'`, classes `nodrag nopan`, `aria-label="Edge label"`, `maxLength={100}`, single-line, width growing with content (`min 4ch, max 24ch`), pre-filled with `data.label ?? ''`, text selected. | must | PRD-026, US-4, D-09e | AC-012 |
| FR-007 | In the edge label input: `Enter` commits, `Escape` cancels (no write), blur commits; commit writes `updateEdgeData(id, { label })` only when the trimmed value differs; an empty commit removes `label` (`data: {}`). All key events are stopped from reaching the pane/window; wheel does not zoom (`nowheel`). | must | PRD-026, US-4 | AC-013 |
| FR-008 | A non-empty label shall render as a pill badge (`rounded-xl bg-elevated border border-surface-border text-copy-secondary text-xs px-2 py-0.5`) centred on `(labelX, labelY)`, not scaled with zoom beyond React Flow's default label layer behaviour; a selected edge with no label shall render a faint hint badge "Double-click to label" in `--text-faint`; unselected unlabelled edges render nothing. | must | PRD-026, ui-context "Edges" | AC-014 |
| FR-009 | Deleting a node through the hook's `onDelete` shall remove all edges whose `source` or `target` is that node in the same step on every client; the author's single undo restores node and edges together. F10 calls `onDelete({ nodes, edges })` with both selected sets; F09 guarantees the edge side renders/un-renders consistently. | must | PRD-025, US-6 | AC-015, AC-016 |
| FR-010 | Every edge shall have `ariaLabel` = `` `edge from ${sourceLabel || sourceShape} to ${targetLabel || targetShape}` `` (+ `, labelled ${label}` when present) via the custom component's wrapper attributes, and be focusable (React Flow default `edgesFocusable`). | should | NFR-006 | AC-017 |
| FR-011 | For viewers: `nodesConnectable={false}` (F06), `edgesReconnectable={false}`, double-click does not open the label input, handles stay hidden (F07 `isConnectable=false` keeps `opacity: 0`); `useCanvasMutations` guards remain. | must | PRD-012, US-7 | AC-018 |
| FR-012 | Edge creation, reconnection, label commit and deletion shall each be exactly one undo entry for their author. | must | PRD-027, D-013 | AC-019 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | Edge add/replace/delete are single Storage writes; TC-0xx records A → B latency. |
| NFR-004 | `CanvasEdge` is `React.memo`; hover handled by CSS (`.react-flow__edge:hover`), not React state; `isValidConnection` reads edges via `useStoreApi().getState().edges` at gesture time, never subscribing to the array; `edgeTypes`/`defaultEdgeOptions` are module-level/memoised. |
| NFR-006 | Edges focusable with `ariaLabel`; label input has `aria-label`; hint text is visible (not colour-only). Keyboard edge creation is not provided by React Flow (documented gap) — recorded in status.md as a known limitation. |
| NFR-007 | `CanvasEdge` typed with `EdgeProps<CanvasEdge>`; handle ids typed as the four-side union. |

## UX and interaction behaviour

- **Connection gesture**: press on a handle (visible on hover, F07), drag — the connection line uses React Flow's default `ConnectionLine` styled `EDGE_STROKE` 60 % dashed; valid target handle shows `.valid` (brand ring), invalid shows `--state-error` ring; release on a handle → edge; release elsewhere → nothing. `connectionMode="loose"` (F06) lets any handle start and end.
- **Hover/selection**: hover brightens to 100 %; click selects (brand-free: the stroke itself brightens and widens; arrowhead follows stroke colour); Shift/⌘ semantics are React Flow defaults (F10 confirms).
- **Reconnect**: hovering a selected edge end within 10 px shows the reconnect anchor; drag it; valid/invalid feedback as above; drop-off deletes.
- **Label editing table**:

| Trigger | Result |
|---|---|
| double-click edge or badge | input opens, text selected |
| `Enter` | commit (if changed) + close |
| `Escape` | discard + close |
| blur | commit (if changed) + close |
| edge removed while editing | input unmounts, no write |

- **Copy**: hint "Double-click to label"; input placeholder "Label".
- **Responsive**: no special handling; edges and badges scale with the viewport like nodes (label layer uses React Flow's default transform).
- **Reduced motion**: no transitions on hover brightness.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Source (or target) node deleted by another user while this user is hovering/editing the edge | Edge disappears atomically with the node; open label input unmounts without a write; no console error | AC-015, AC-013 (unmount case) |
| EC-002 | A connects X→Y while B is dragging Y | Edge is created; its target end follows Y's synced position; no divergence after 2 s | AC-020 |
| EC-003 | Reconnect to the same handle pair | No `replace` change, no undo entry | AC-010 |
| EC-004 | Two users create the same (X.right → Y.left) edge within 200 ms | Both writes pass local validation (neither saw the other); two edges with distinct ids exist; rendered overlapping. Documented and accepted for M1 (no server-side uniqueness); F19/F17 may add a dedupe pass | AC-021 |
| EC-005 | Connection released on the pane, a sidebar, or outside the window | Nothing created; no undo entry | AC-008 |
| EC-006 | Self-loop attempt (handle of X to another handle of X) | Invalid feedback; nothing created | AC-007 |
| EC-007 | Edge label paste of 500 characters or containing newlines | Truncated to 100; newlines stripped | AC-013 |
| EC-008 | Viewer attempts reconnect/double-click | No affordance; nothing happens | AC-018 |
| EC-009 | Remote edge whose `sourceHandle`/`targetHandle` is missing (older or foreign data) | Renders from the node centre-ish default React Flow position; no crash; F13 migration/validation rejects on save | AC-003 (render smoke with missing handle in unit fixture) |
| EC-010 | 800 edges present; one node dragged | Only edges attached to that node re-render (memo + React Flow internals) | NFR-004 manual perf check (F15), noted |
| EC-011 | `defaultEdgeOptions` not applied to controlled edges (T-001 fails) | Switch to D-09c fallback (`<defs>` marker in `CanvasEdge`); no schema impact | T-001 |
