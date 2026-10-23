# F07 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The workspace shall render a bottom-centre palette pill containing exactly six icon buttons, one per `NODE_SHAPES` entry in that order (rectangle, diamond, circle, pill, cylinder, hexagon), each with `aria-label="Add <shape>"` and a tooltip showing the shape name and "Drag onto canvas, or press Enter". | must | PRD-021, US-1, US-4 | AC-001, AC-002 |
| FR-002 | Pressing a palette button with a pointer and moving ≥ 4 px shall start a drag: the button captures the pointer (`setPointerCapture`), a ghost preview follows the pointer, and the ghost is centred on the pointer with size `DEFAULT_SIZES[shape] × currentZoom`, `pointer-events: none`, `aria-hidden`. | must | PRD-021, US-1 | AC-003, AC-004 |
| FR-003 | On `pointerup`, the drop target shall be resolved with `document.elementFromPoint(clientX, clientY)`; if that element is inside the flow pane (`.react-flow` within the F06 canvas container) a node is created, otherwise the drag is cancelled with no side effect. | must | PRD-021, US-1 | AC-005, AC-006 |
| FR-004 | The created node's `position` shall equal `screenToFlowPosition({ x: clientX, y: clientY })` minus half the shape's default size, so that the node's centre is within 1 px of the pointer at any zoom in [0.5, 2] and any pan. **(reference bug §4)** | must | PRD-021, US-2 | AC-007, AC-008 |
| FR-005 | Node creation shall emit exactly one `{ type: 'add', item }` change through the F06 hook's `onNodesChange`, where `item = { id: newNodeId(shape), type: 'canvasNode', position, width, height, data: { label: '', shape, color: 'neutral' } }` and `width/height = DEFAULT_SIZES[shape]`. No other React state holds the node. | must | PRD-021, PRD-030, D-07a | AC-009, AC-010 |
| FR-006 | Dropping a node shall not call `fitView`, `setViewport`, `setCenter`, `zoomTo` or otherwise change the viewport; the viewport transform before and after the drop shall be identical, including the first drop on an empty canvas. **(reference bug §5)** | must | PRD-021, US-3, D-020 | AC-011 |
| FR-007 | Activating a palette button by click (pointerup without exceeding the 4 px threshold) or by keyboard (`Enter`/`Space` while focused) shall create the shape centred on the visible flow viewport (centre of the container's bounding rect converted with `screenToFlowPosition`). | must | NFR-006, US-4, D-07d | AC-012 |
| FR-008 | After creation the new node shall be the only selected node (local `select` changes), and focus shall move to the node's DOM element so arrow-key nudge and F08 editing work immediately. | should | US-4, D-07f | AC-013 |
| FR-009 | `components/canvas/nodes/canvas-node.tsx` shall render all six shapes: rectangle, pill, circle via CSS (`border-radius` 12 px / 9999 px / 50 %); diamond, hexagon, cylinder via inline SVG with `viewBox` and `preserveAspectRatio="none"` so the outline scales with `width`/`height`. Fill and text use `NODE_COLORS[data.color]`; the label is centred; border is `--border-default` 1 px at rest and `--accent-primary` 2 px when `selected`. | must | PRD-021, ui-context "Shapes" | AC-014, AC-015 |
| FR-010 | Every node shall render four `<Handle>` components with `id` ∈ `top|right|bottom|left`, matching `position` (`Position.Top` …), `type="source"`, and `isConnectable={canEdit}`. Handles are 8 × 8 px white dots with a 1 px `--bg-base` border, `opacity: 0` at rest, `opacity: 1` on node hover and while the handle or node has the `.connecting`/`.valid` class or a connection is in progress. Handles are never `display: none` or `visibility: hidden`. **(reference bug §3)** | must | PRD-025, ui-context "Handles" | AC-016, AC-017 |
| FR-011 | The node component shall be wrapped in `React.memo`; `nodeTypes = { canvasNode: CanvasNode }` shall be a module-level constant; each node shall set `ariaLabel` to `` `${shape} ${label || 'unlabelled'}` ``. | must | NFR-004, NFR-006, code-standards | AC-018, AC-019 |
| FR-012 | When `role === 'viewer'` the palette shall not be rendered and `useCanvasMutations().addNode` shall be a no-op that logs nothing; node creation UI affordances are absent. The server-issued `*:read` token is the enforcement (F05). | must | PRD-012 | AC-020 |
| FR-013 | No element between `<body>` and the flow pane shall call `preventDefault`/`stopPropagation` on `pointerdown`, `pointermove`, `pointerup` or `contextmenu` for events originating in the pane, and the ghost shall not be the result of `elementFromPoint` at the drop point. **(reference bug: parent intercepting DnD events)** | must | PRD-021, US-1 | AC-021 |
| FR-014 | Node ids shall be `${shape}_${ulid}` and edge ids `e_${ulid}` from `lib/canvas/ids.ts`; two clients creating nodes in the same millisecond shall produce distinct ids. | must | domain-model ids | AC-022 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | A created node reaches other clients via the F06 hook pipeline; TC-021 measures A-drop → B-render < 1 s (p95 < 500 ms target from NFR-003 recorded in status.md). |
| NFR-004 | `React.memo` node, module-level `nodeTypes`, no `nodes` array read in the palette/ghost; ghost positioned via `transform` on a single fixed element (no layout thrash). |
| NFR-006 | Keyboard placement (FR-007), `aria-label` on every button, tooltips, node `ariaLabel`, React Flow built-in a11y untouched; handles keep `handle.ariaLabel` from `ariaLabelConfig` (F06). |
| NFR-007 | `CanvasNode` typed as `NodeProps<CanvasNode>`; `DEFAULT_SIZES: Record<NodeShape, { width; height }>`; exhaustive `switch` on `shape` with `never` default. |
| NFR-010 | No new runtime dependency except `ulid` if F06 did not add it (see 04). |

## UX and interaction behaviour

- **Palette**: `fixed bottom-4 left-1/2 -translate-x-1/2`, `rounded-xl bg-surface/95 border border-surface-border shadow-lg`, 6 buttons 40 × 40 px with `lucide-react` icons (`Square`, `Diamond`, `Circle`, `RectangleHorizontal` with `rounded-full` styling for pill, `Database` for cylinder, `Hexagon`), `h-5 w-5` icons, `text-copy-secondary` → `text-copy-primary` on hover/focus, visible focus ring (`ring-2 ring-brand`). Gap 4 px, padding 6 px. Below 768 px: padding 4 px, gap 2 px, buttons 36 px.
- **States** per button: rest · hover · focus-visible · dragging (button shows `bg-brand-dim`, cursor `grabbing` on `<html>` while dragging) · disabled (never; palette is absent for viewers).
- **Ghost**: a single `div` portaled to `document.body`, `position: fixed; left: 0; top: 0; transform: translate(clientX - w/2, clientY - h/2)`, rendered by the same `ShapeRenderer` used in nodes with `data.color = 'neutral'` and 70 % opacity, dashed brand border. Removed on drop, cancel, `pointercancel`, `Escape`, window `blur`.
- **Cursor** during drag: `cursor: grabbing` on `<html>`; over a non-droppable region the ghost gets a `not-allowed` badge? — no (keep minimal): the ghost simply fades to 40 % when `elementFromPoint` is outside the pane on the latest `pointermove`.
- **Keyboard**: Tab reaches each palette button; `Enter`/`Space` → FR-007; `Escape` while focused does nothing (no drag in progress). During a pointer drag `Escape` cancels.
- **Copy**: tooltip "Rectangle — drag onto canvas, or press Enter" (shape name capitalised; "Pill", "Cylinder", "Hexagon", "Diamond", "Circle").
- **Node label at rest**: empty label renders an empty centred `span` with `min-height: 1em`; placeholder text is F08's concern.
- **Reduced motion**: ghost appears/disappears without transition when `prefers-reduced-motion`.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Pointer released outside the flow pane (over a sidebar, navbar, palette, or outside the window) | Drag cancelled; ghost removed; no `onNodesChange` call; no history entry | AC-006 |
| EC-002 | Viewer opens the workspace | Palette absent; `addNode` no-op; a hand-crafted write from devtools is rejected by Liveblocks (read token, F05) | AC-020 |
| EC-003 | Users A and B drop a shape within the same second | Two nodes with distinct ids; both visible on both clients with the positions each author chose | AC-022, AC-010 |
| EC-004 | First drop onto a canvas with zero nodes | Viewport unchanged (no auto-fit) **(reference bug §5)** | AC-011 |
| EC-005 | `pointercancel`, `Escape`, or window `blur` during a drag | Ghost removed, pointer capture released, no node created | AC-006 |
| EC-006 | Drop at zoom 0.5 and 2.0, after panning by (−640, 480) | Node centre within 1 px of pointer | AC-007, AC-008 |
| EC-007 | Client offline (Liveblocks `disconnected`) when dropping | Node appears locally, change queued, appears for others after reconnect (liveblocks.md §8) | AC-023 |
| EC-008 | Viewport narrower than 768 px | Compact palette still operable; no overlap with the F10 control bar (control bar moves up) | AC-002 |
| EC-009 | Drop while the F08 label editor of another node is open | Editor blurs and commits (F08), then the drop proceeds; no lost keystrokes | F08/AC-0xx (blur commit); here AC-005 only |
| EC-010 | 500 nodes present; one node is dragged | Unrelated `CanvasNode` instances do not re-render (memo) | AC-019 |
| EC-011 | Button receives `pointerdown` from a secondary button (right/middle) | Ignored; no drag starts | AC-003 |
| EC-012 | Hook rejects an `add` change (spike T-001 fails) | Spec is blocked; owner decides between the fallback in 02-design and a schema-aware Storage mutation; nothing is built on the unverified path | T-001 |
