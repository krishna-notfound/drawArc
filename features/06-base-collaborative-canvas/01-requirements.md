# F06 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The system shall rely on F01's installation of `@xyflow/react` (`~12.12`, D-F01-1) and F01's stylesheet import in `app/globals.css` placed after `@import "tailwindcss"`; F06 installs neither and a unit test shall assert both are present. | must | NFR-010, D-023, F01/FR-003 | AC-001 |
| FR-002 | `types/canvas.ts` shall export `NODE_SHAPES`, `NODE_COLOR_IDS`, `NODE_COLORS`, `HANDLE_IDS`, `DEFAULT_SIZES`, `MIN_SIZE`, `CANVAS_SCHEMA_VERSION = 1`, and the types `CanvasNodeData`, `CanvasNode`, `CanvasEdgeData`, `CanvasEdge`, `PersistedNode`, `PersistedEdge`, `CanvasDocument` exactly as in `context/domain-model.md` and `02-design.md`. | must | domain-model, ui-context | AC-002, AC-003 |
| FR-003 | Every `NODE_COLORS` pair shall meet WCAG contrast ≥ 4.5:1 (text on fill), and `USER_COLORS` (F05) shall equal the seven non-neutral text colours in order. | must | NFR-006, F05 P-05-6 | AC-003 |
| FR-004 | `lib/canvas/schema.ts` shall export `CanvasDocumentSchema` (Zod, v1), `PersistedNodeSchema`, `PersistedEdgeSchema`, `MAX_NODES = 2000`, `MAX_EDGES = 4000`, `validateDocument(input: unknown): Result<CanvasDocument, ZodError>`, and `migrate(doc: unknown): unknown` (no-op chain for v1) with the rules in `02-design.md`. | must | NFR-002, security-model | AC-004, AC-005, AC-006 |
| FR-005 | `lib/canvas/serialize.ts` shall export `toDocument(nodes, edges): CanvasDocument` that emits only persisted fields (allowlist), fills missing `width`/`height` from `measured` then `DEFAULT_SIZES[shape]`, and `fromDocument(doc): { nodes: CanvasNode[]; edges: CanvasEdge[] }`; `toDocument(fromDocument(d))` shall deep-equal `d` for every fixture. | must | data-ownership, domain-model rules | AC-007, AC-008 |
| FR-006 | `components/canvas/flow-canvas.tsx` shall be a `'use client'` component rendering `<ReactFlowProvider>` → `<ReactFlow>` fed exclusively by `useLiveblocksFlow({ suspense: true, storageKey: 'flow', nodes: { initial: [] }, edges: { initial: [] } })` (`nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`, `onDelete`); no `useState`/store copy of nodes or edges shall exist. | must | PRD-030, code-standards "React and client state" | AC-009, AC-010 |
| FR-007 | `nodeTypes = { canvasNode }` and `edgeTypes = { canvasEdge }` shall be module-level constants; handlers passed to `<ReactFlow>` shall be stable (`useCallback`) and option objects memoised. | must | code-standards, research §13 | AC-010 |
| FR-008 | `<ReactFlow>` shall be configured with: `connectionMode="loose"`, `selectionOnDrag`, `selectionMode="partial"`, `panOnScroll`, `panOnDrag={[1, 2]}`, `zoomOnScroll={false}` (zoom via ⌘/Ctrl+scroll handled by `zoomActivationKeyCode`), `deleteKeyCode={null}`, `minZoom={0.1}`, `maxZoom={4}`, `proOptions={{ hideAttribution: true }}` only if licensed else default, `nodeOrigin={[0, 0]}`, and no `fitView` prop. | must | D-020, P-06-1, P-06-2 | AC-010, AC-011 |
| FR-009 | `onInit` shall call `fitView({ padding: 0.2, maxZoom: 1 })` exactly once and only when `nodes.length > 0` at mount; no code path shall call `fitView`/`fitBounds`/`setViewport` after a node is added or dropped. **Explicit exemptions:** (a) the user-invoked controls in F10 (`fitView` button / `Shift+1`), and (b) the template import in F14 `hooks/useImportTemplate.ts`, which calls `fitView` exactly once after a `CANVAS_REPLACED` import for the importer only (F14 D-14d). The repo grep guard for `fitView(` therefore allowlists `hooks/useCanvasActions.ts` (F10) and `hooks/useImportTemplate.ts` (F14) and nothing else; the drop prohibition (F07 FR-006) is unaffected. | must | reference bug (auto-zoom on first drop), D-020, F14 D-14d | AC-011, AC-012 |
| FR-010 | The canvas shall render `<Background variant="dots" gap={20} />` over `bg-base` and `<MiniMap position="bottom-right" pannable={false} zoomable={false} />` hidden below 768 px (`hidden md:block`). | must | PRD-020, ui-context | AC-013, AC-014 |
| FR-011 | The canvas root shall be `position: fixed; inset: 0` (or fill its full-viewport parent) with no border, border-radius, box-shadow, padding, margin, or wrapper surface; the dot pattern shall be visible edge-to-edge under the floating sidebars (F04). | must | PRD-020, reference bug (floating card) | AC-014 |
| FR-012 | For `role === 'viewer'` or `useSelf().canWrite === false`, `nodesDraggable`, `nodesConnectable`, `elementsSelectable`, `edgesReconnectable` shall be `false`, panning/zooming remain enabled, and a muted "View only" badge shall be shown near the status pill. | must | PRD-012, P-06-4 | AC-015, AC-016 |
| FR-013 | Placeholder renderers shall exist: `canvasNode` draws a `bg-surface` rectangle with `border-surface-border` showing `data.label` (or "unlabelled") sized by `width`/`height`, with four `<Handle>`s (`top|right|bottom|left`, `type="source"`, `opacity: 0` at rest) so F09 can connect later; `canvasEdge` draws a `BaseEdge` smooth-step path. Both carry `ariaLabel = \`${shape} ${label || 'unlabelled'}\``. | must | ui-context "Handles", NFR-006 | AC-017 |
| FR-014 | A dev/test affordance (`DevAddNode`, `data-testid="dev-add-node"`) shall exist only when `NEXT_PUBLIC_E2E_HOOKS === '1'` or `NODE_ENV !== 'production'`, adding one `rectangle` node `{ id: rectangle_<ulid>, type: 'canvasNode', position: { x: 80 + 40·n, y: 80 + 40·n }, width: 180, height: 80, data: { label: 'Node n', shape: 'rectangle', color: 'neutral' } }` via `onNodesChange([{ type: 'add', item }])`; it shall be removed by F07. | must | P-06-3 | AC-018 |
| FR-015 | `FlowCanvas` shall accept `children` rendered inside `<ReactFlow>` (so F07 palette, F10 controls, F11 `<Cursors/>` can use `useReactFlow` and flow coordinates) and a `role` prop; it shall replace the F05 placeholder inside `<ProjectRoom>`. | must | F07/F10/F11 contracts | AC-009 |
| FR-016 | On approval, `schemaVersion: 1` is frozen; a repo guard test shall fail if `CANVAS_SCHEMA_VERSION` changes without a matching `migrateV{n}ToV{n+1}` export and fixture `tests/fixtures/canvas/v{n}-*.json`. | must | P-06-6, D-002 | AC-019 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-002 | `CanvasDocumentSchema` is the single Zod boundary reused by F13/F14/F17. |
| NFR-003 | Edit → remote render p95 < 500 ms measured by TC-013 (timestamps around `dev-add-node` click and remote locator visibility). |
| NFR-004 | `onlyRenderVisibleElements` left default (false) in M1; `large-500-nodes` fixture renders in TC-016 without error (fps measured in F15). |
| NFR-006 | React Flow built-in keyboard a11y kept (`nodesFocusable`, `edgesFocusable` default); `ariaLabel` on nodes; colour-pair contrast test. |
| NFR-007 | `Node<CanvasNodeData, 'canvasNode'>` / `Edge<CanvasEdgeData, 'canvasEdge'>` generics; `z.infer` types equal hand-written types (type test). |
| NFR-010 | `~12.12.0` pin test. |

## UX and interaction behaviour

| Aspect | Behaviour |
|---|---|
| Surface | Full viewport, `bg-base`, dots gap 20 (`--border-default` colour), no chrome around it; sidebars/palette/pills float above (z-index from F04). |
| Pan | scroll (`panOnScroll`), middle/right drag (`panOnDrag=[1,2]`), Space+drag (F10 adds the key handling; here Space is React Flow's default `panActivationKeyCode`). |
| Zoom | ⌘/Ctrl + scroll (`zoomActivationKeyCode` default Meta/Control), pinch; range 0.1–4. Double-click zoom disabled (`zoomOnDoubleClick={false}`) because double-click edits labels in F08. |
| Select | Drag on empty canvas draws a box (partial overlap selects); Shift+click adds; ⌘/Ctrl+click toggles (`multiSelectionKeyCode` default). Viewers: nothing selectable. |
| Initial view | If the room has nodes: fit once with 20 % padding, zoom ≤ 1. If empty: default viewport (0,0 at zoom 1); nothing moves on first add. |
| Loading | `ClientSideSuspense` fallback from F05 until Storage is loaded (`suspense: true` guarantees arrays afterwards). |
| MiniMap | Bottom-right, non-interactive, `bg-surface` with `maskColor` from tokens; hidden < 768 px. |
| Viewer badge | "View only" text pill (muted) left of the connection-status pill. |
| Reduced motion | `fitView` duration 0 under `prefers-reduced-motion`. |

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Storage contains a node with unknown `shape`/`color` (e.g. from a future version) | Renderer falls back to `rectangle`/`neutral` visuals and logs once per id; `toDocument` output then fails validation (F13 refuses to save), which is intended | AC-017, AC-005 |
| EC-002 | Two users add nodes simultaneously | Both nodes exist for both users (distinct ULIDs) ≤ 1 s | AC-020 |
| EC-003 | Two users drag the same node (R-01) | Converge to one position ≤ 2 s after both stop (server-ordered LWW); no crash | AC-021 |
| EC-004 | User B offline, adds a node, reconnects | A sees B's node after reconnect | AC-022 |
| EC-005 | User reloads | Same node count, ids, positions (from Storage) | AC-023 |
| EC-006 | `useLiveblocksFlow` options would be changed after mount | Not supported (mount-time only); options are literal constants — enforced by a lint comment and the unit test asserting the exact option object | AC-010 |
| EC-007 | Viewer attempts a mutation (devtools) | Liveblocks server rejects (read token, F05); UI shows no change; no crash | AC-016 |
| EC-008 | 500-node fixture seeded into the room (via F13 or dev server) | Canvas renders; pan/zoom responsive; MiniMap shows all | AC-024 |
| EC-009 | Window narrower than 768 px | MiniMap hidden; canvas still full-viewport | AC-013 |
| EC-010 | Document with `nodes.length > 2000` or `edges.length > 4000` | `validateDocument` fails with a `too_big` issue on the array | AC-005 |
| EC-011 | Edge references a missing node, or `source === target`, or duplicate ids | `validateDocument` fails with a custom issue naming the edge id | AC-005 |
| EC-012 | `migrate` receives a document with `schemaVersion > CANVAS_SCHEMA_VERSION` | Returns input unchanged; `validateDocument` then fails on the literal `1` — callers (F13) surface "newer app version required" | AC-006 |
