# F07 — Design

## Architecture and components

All of F07 is client-side (`"use client"`), under the `<ReactFlowProvider>` that F06 mounts around the flow island so the palette (a sibling of `<ReactFlow>`) can call `useReactFlow()` (react-flow.md §10, S13/S11). Dependency direction is respected: `components/canvas/*` → `hooks/*` → `lib/canvas/*` → `types/canvas.ts`; `lib/` contains no React.

```
components/canvas/flow-canvas.tsx (F06)          ─ owns <ReactFlowProvider>, <ReactFlow …>, role prop
├─ components/canvas/shape-palette.tsx (F07, new)   ─ six buttons; uses useShapeDrag + useCanvasMutations
│   └─ components/canvas/shape-drag-ghost.tsx (new) ─ portal to document.body, pointer-events:none
├─ components/canvas/node-types.ts (F06, modified)   ─ registry: `nodeTypes.canvasNode` now points at CanvasNode (replaces F06's placeholder-node.tsx, which is deleted)
├─ components/canvas/nodes/canvas-node.tsx (new)    ─ React.memo; ShapeRenderer + NodeHandles; F08 adds resizer/editor/toolbar here
│   ├─ components/canvas/nodes/shape-renderer.tsx   ─ pure presentational; reused by the ghost and F14 previews are NOT this (SVG-only there)
│   └─ components/canvas/nodes/node-handles.tsx     ─ four <Handle>s
hooks/useShapeDrag.ts (new)                          ─ pointer capture, threshold, ghost coords, drop resolution
hooks/useCanvasMutations.ts (new)                    ─ typed wrapper over F06's onNodesChange/onEdgesChange; the only write path
lib/canvas/drop-position.ts (new)                    ─ pure maths, unit-tested
lib/canvas/ids.ts (new unless F06 created it)        ─ newNodeId(shape), newEdgeId()
types/canvas.ts (F06)                                ─ NODE_SHAPES, DEFAULT_SIZES, NODE_COLORS, CanvasNode …  (unchanged)
app/globals.css (modified)                           ─ .canvas-handle rules, ghost styles
```

Files modified in F06-owned code: `components/canvas/node-types.ts` swaps the `canvasNode` entry from `PlaceholderNode` to `CanvasNode` (registry keys unchanged, as F06 intended); `flow-canvas.tsx` renders `<ShapePalette>` when `role !== 'viewer'` and drops F06's `DevAddNode` affordance (F06/FR-014 says it "shall be removed by F07"). No `<ReactFlow>` interaction prop changes (F06 already sets `connectionMode="loose"`, `deleteKeyCode={null}`, `fitView` initial-only, `nodesConnectable={role !== 'viewer'}`, `nodesDraggable={role !== 'viewer'}`).

### Drag lifecycle (`useShapeDrag`)

1. `onPointerDown(e, shape)` on a palette button: ignore if `e.button !== 0`; record `{ shape, startX, startY, pointerId }`; `e.currentTarget.setPointerCapture(e.pointerId)`.
2. `onPointerMove`: if not yet dragging and `hypot(dx, dy) ≥ 4` → `dragging = true`, add `cursor-grabbing` class on `<html>`, mount ghost. While dragging: `ghost = { x: clientX, y: clientY, w: DEFAULT_SIZES[shape].width × getZoom(), h: … × getZoom(), overPane: isInsidePane(elementFromPoint(clientX, clientY)) }` stored in a `useRef` + a single `useState` tick throttled to animation frames (`requestAnimationFrame`), so the palette does not re-render per move.
3. `onPointerUp`: `releasePointerCapture`; if `dragging` → `resolveDrop(clientX, clientY)`; else → `placeAtViewportCentre(shape)` (FR-007). Clear state either way.
4. `onPointerCancel`, `keydown Escape` (document), window `blur` → cancel (same as a non-dragging pointer-up without placement).
5. `isInsidePane(el)` = `el?.closest('.react-flow__pane') !== null && containerRef.current.contains(el)`. Because the ghost has `pointer-events: none`, `elementFromPoint` never returns it (FR-013).
6. `resolveDrop`: `const p = screenToFlowPosition({ x, y }); addNode(shape, centredDropPosition(p, DEFAULT_SIZES[shape]))`.

Why pointer events and capture (D-07b): the official example uses `setPointerCapture` + document `pointerup` + `elementFromPoint` (react-flow.md §10, S62). Capture guarantees we receive `pointerup` even if released over an iframe-free overlay or outside the window, and it works for touch, which HTML5 DnD does not ("poor touch support", S62). It also sidesteps the reference bug where a wrapper needed `onDragOver`/`preventDefault` to allow dropping — there is no drop target to configure.

### Node creation (`useCanvasMutations`)

```ts
addNode(shape: NodeShape, position: XYPosition): CanvasNode | null {
  if (!canEdit) return null;
  const { width, height } = DEFAULT_SIZES[shape];
  const item: CanvasNode = { id: newNodeId(shape), type: 'canvasNode', position, width, height,
    data: { label: '', shape, color: 'neutral' } };
  onNodesChange([{ type: 'add', item }]);               // F06 hook → Liveblocks Storage
  onNodesChange([{ type: 'select', id: item.id, selected: true }]);  // local-only (liveblocks.md §1)
  return item;
}
```

`width`/`height` are set explicitly because persisted nodes require them (domain-model) and React Flow v12 renders them as fixed inline sizes (react-flow.md §5, S10). Selection is emitted as a separate change so that if the hook ignores `select` (local-only) nothing is lost; the previous selection is cleared first with `unselectNodesAndEdges()` from `useStoreApi().getState()` (UNVERIFIED name — fallback: emit `select:false` changes for currently selected ids read from the store at event time).

## Domain model and TypeScript contracts

No change to canvas schema v1. Contracts introduced:

```ts
// lib/canvas/drop-position.ts
export function centredDropPosition(flowPoint: XYPosition, size: { width: number; height: number }): XYPosition
// → { x: flowPoint.x - size.width / 2, y: flowPoint.y - size.height / 2 }

// lib/canvas/ids.ts
export function newNodeId(shape: NodeShape): `${NodeShape}_${string}`   // `${shape}_${ulid()}`
export function newEdgeId(): `e_${string}`

// hooks/useShapeDrag.ts
export interface ShapeDragState { shape: NodeShape; x: number; y: number; width: number; height: number; overPane: boolean }
export function useShapeDrag(opts: { containerRef: RefObject<HTMLElement>; onDrop(shape, client: XYPosition): void; onPlace(shape): void }):
  { drag: ShapeDragState | null; buttonProps(shape: NodeShape): PointerEventHandlers & KeyboardEventHandlers }

// hooks/useCanvasMutations.ts  (consumed by F08, F09, F10, F14)
export interface CanvasMutations {
  canEdit: boolean;
  addNode(shape: NodeShape, position: XYPosition): CanvasNode | null;
  addNodes(items: CanvasNode[]): void;                       // F14
  replaceNode(item: CanvasNode): void;                       // emits { type: 'replace', id, item }
  updateNodeData(id: string, patch: Partial<CanvasNodeData>): void;   // reads current node from store, emits replace with new data object
  addEdge(item: CanvasEdge): void;  replaceEdge(item: CanvasEdge): void;  updateEdgeData(id: string, patch: Partial<CanvasEdgeData>): void;
  onDelete: UseLiveblocksFlowResult['onDelete'];              // pass-through
}
```

`ShapeRenderer` props: `{ shape: NodeShape; color: NodeColorId; selected?: boolean; children?: ReactNode; className?: string }`. SVG shapes: diamond `polygon points="50,0 100,50 50,100 0,50"`, hexagon `polygon points="25,0 75,0 100,50 75,100 25,100 0,50"`, cylinder = `rect` body + two `ellipse` caps (ry = 10 % of height), each inside `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">` with `fill`/`stroke` from `NODE_COLORS` and the border token via `stroke="currentColor"` on a wrapper whose `color` is the border token; `vector-effect="non-scaling-stroke"` keeps the 1–2 px border crisp at any size.

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Node (`id, type, position, width, height, data`) | Liveblocks Storage via the F06 hook | Written only through `useCanvasMutations` (data-ownership rule 1). |
| Selection of the new node | React Flow store (client memory) | Local-only field; never synced (liveblocks.md §1). |
| Drag state, ghost position | `useShapeDrag` refs (client memory) | Ephemeral; no persistence; not in history. |
| Viewport | React Flow (per user) | Read (`getZoom`, `screenToFlowPosition`) but never written by F07 (FR-006). |

No new derived copies.

## API and integration contracts

No routes, Server Actions, webhooks or Trigger.dev tasks. Liveblocks integration: `onNodesChange` changes of type `add` (+ `select`, local). Room events: none. Role comes from the F06 `role` prop (server-computed, D-015).

## Security and validation

- Threat: a viewer forges an `add` change from devtools → Liveblocks rejects writes for a `*:read` token (security-model "Collaboration room access"); the UI layer (`canEdit`) is only an affordance. Verified by F05's auth tests; F07 adds the UI-absence check.
- Threat: a malicious collaborator writes a node with an unknown `shape`/`color` → not F07's boundary; `CanvasDocumentSchema` validates on autosave (F13) and `ShapeRenderer`'s exhaustive `switch` falls back to `rectangle` rendering with a `logger.warn` for unknown shapes (defensive rendering, never a crash).
- Input validation: `shape` comes from a closed union bound to the button, never from user text. No rate limit (local interaction).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Official DnD example uses pointer events, `setPointerCapture`, document `pointerup`, `elementFromPoint`, `screenToFlowPosition`; HTML5 DnD "has poor touch support" | https://reactflow.dev/examples/interaction/drag-and-drop | checked 2026-10-22 |
| `screenToFlowPosition(clientPosition, { snapToGrid?, snapGrid? })` converts client → flow coords accounting for pan/zoom; `getZoom()`; all on `useReactFlow()` which needs a provider ancestor | https://reactflow.dev/api-reference/types/react-flow-instance , https://reactflow.dev/api-reference/hooks/use-react-flow | checked 2026-10-22 |
| Default `nodeOrigin` is `[0,0]` (top-left on cursor) — hence subtract half size | https://reactflow.dev/api-reference/types/node-origin | checked 2026-10-22 |
| `fitView` prop applies to initially provided nodes only; later fits are instance calls | https://reactflow.dev/api-reference/react-flow | checked 2026-10-22 |
| `NodeChange` includes `add` and `select` variants; `applyNodeChanges` handles them | https://reactflow.dev/api-reference/types/node-change , https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/utils/changes.ts | checked 2026-10-22 |
| Handles need unique `id`s; hide with `opacity: 0`, never `display: none` ("will report a width and height of 0!"); `.connecting`/`.valid` classes during a connection; `ConnectionMode.Loose` allows any handle to any handle | https://reactflow.dev/learn/customization/handles , https://reactflow.dev/api-reference/types/connection-mode | checked 2026-10-22 |
| Custom node component receives `NodeProps<CanvasNode>`; define `nodeTypes` outside the component | https://reactflow.dev/learn/customization/custom-nodes , https://reactflow.dev/learn/advanced-use/typescript | checked 2026-10-22 |
| v12: `width`/`height` on a node are fixed inline sizes; `measured` holds measurements | https://reactflow.dev/learn/troubleshooting/migrate-to-v12 | checked 2026-10-22 |
| `useLiveblocksFlow` returns `{ nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete }`; syncs `position/width/height/data/handles`; `selected/dragging/measured/resizing` local-only | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| Offline changes are queued and sent on reconnect | https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync | checked 2026-10-22 |
| **UNVERIFIED**: that `useLiveblocksFlow`'s `onNodesChange` persists `add` and `replace` changes (the API page lists the handler but not the change types it honours). Fallback if T-001 fails: `useMutableStorage()` (v3.24.1, liveblocks.md §2) wrapped in `room.batch()` writing into the package-managed `flow` LiveObject — requires owner approval because `domain-model.md` forbids hand-editing that layout. | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| **UNVERIFIED**: store action name `unselectNodesAndEdges` on `useStoreApi().getState()` — fallback: emit `select:false` changes. | — | — |
