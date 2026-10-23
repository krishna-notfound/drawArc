# F09 — Design

## Architecture and components

Client-only. New and modified files:

```
components/canvas/edges/canvas-edge.tsx (new)        ─ React.memo edge; path, BaseEdge, label badge/editor
components/canvas/node-types.ts (F06, modified)      ─ registry: `edgeTypes.canvasEdge` now points at CanvasEdge (F06's placeholder-edge.tsx is deleted; keys unchanged)
components/canvas/edges/edge-label-editor.tsx (new)  ─ growing single-line input inside EdgeLabelRenderer
lib/canvas/connections.ts (new)                      ─ pure: isSelfLoop, isDuplicateConnection, sameEndpoints, buildEdge
hooks/useCanvasConnections.ts (new)                  ─ onConnect, isValidConnection, onReconnectStart/onReconnect/onReconnectEnd (useCallback), reads store at event time
hooks/useCanvasMutations.ts (F07, used)              ─ addEdge, replaceEdge, updateEdgeData, onDelete
components/canvas/flow-canvas.tsx (F06, modified)  ─ edgeTypes, defaultEdgeOptions, isValidConnection, onConnect, onReconnect*, edgesReconnectable
types/canvas.ts (F06, modified)                      ─ + export const EDGE_STROKE = '#f8fafc'; + EDGE_LABEL_MAX_LENGTH = 100
app/globals.css (modified)                           ─ .react-flow__edge rules (rest/hover/selected), connection line, label badge
```

### Connection pipeline

```
Handle pointerdown → React Flow connection gesture → isValidConnection(conn) [pure checks over store edges]
  → release on valid handle → onConnect(conn) → buildEdge(conn) → mutations.addEdge(edge)
       → F06 hook onEdgesChange([{ type: 'add', item: edge }]) → Liveblocks Storage → all clients
```

```ts
// lib/canvas/connections.ts
export function isSelfLoop(c: Connection): boolean                      // c.source === c.target
export function isDuplicateConnection(c: Connection, edges: readonly CanvasEdge[]): boolean
  // some(e => e.source===c.source && e.sourceHandle===c.sourceHandle && e.target===c.target && e.targetHandle===c.targetHandle)
export function sameEndpoints(e: CanvasEdge, c: Connection): boolean
export function buildEdge(c: Connection, id = newEdgeId()): CanvasEdge
  // { id, source, target, sourceHandle: c.sourceHandle as HandleId, targetHandle: c.targetHandle as HandleId, type: 'canvasEdge', data: {} }
  // throws if sourceHandle/targetHandle is null (cannot happen with our nodes: every handle has an id)
```

`useCanvasConnections({ mutations })` returns memoised handlers:
- `isValidConnection(c)`: `!isSelfLoop(c) && !isDuplicateConnection(c, store.getState().edges as CanvasEdge[])`. Placed on `<ReactFlow>` (not per handle) per React Flow's performance advice.
- `onConnect(c)`: `if (!mutations.canEdit) return; mutations.addEdge(buildEdge(c))`.
- Reconnection uses a `reconnectSucceededRef`: `onReconnectStart` → `false`; `onReconnect(oldEdge, c)` → `true`; if `sameEndpoints(oldEdge, c)` return (EC-003); if invalid per the same checks (excluding `oldEdge` itself from the duplicate scan) return; else `mutations.replaceEdge({ ...oldEdge, source: c.source, target: c.target, sourceHandle, targetHandle })`; `onReconnectEnd(_, edge)` → if `!reconnectSucceededRef.current` → `mutations.onDelete({ nodes: [], edges: [edge] })`. This mirrors the React Flow reconnect example's documented contract (`onReconnect` + `reconnectEdge` + end handler; the delete-on-drop code is in the example ZIP, not fetched — our implementation is independent).

### Edge component

```tsx
export const CanvasEdge = memo(function CanvasEdge(p: EdgeProps<CanvasEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX: p.sourceX, sourceY: p.sourceY, sourcePosition: p.sourcePosition,
    targetX: p.targetX, targetY: p.targetY, targetPosition: p.targetPosition, borderRadius: 8 });
  const [editing, setEditing] = useState(false);
  return (
    <g onDoubleClick={canEdit ? () => setEditing(true) : undefined} className="canvas-edge" aria-label={ariaLabel}>
      <BaseEdge id={p.id} path={path} markerEnd={p.markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <div className="nodrag nopan canvas-edge__label" style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}>
          {editing ? <EdgeLabelEditor … /> : label ? <Badge/> : p.selected ? <Hint/> : null}
        </div>
      </EdgeLabelRenderer>
    </g>);
});
// components/canvas/node-types.ts (F06): export const edgeTypes = Object.freeze({ canvasEdge: CanvasEdge });
```

- `canEdit` is read from a `CanvasRoleContext` provided by the F06 island (edges receive no role prop from React Flow). If F06 did not create such a context, F09 adds `components/canvas/canvas-role-context.tsx` (`{ role, canEdit }`) and the island provides it; F08's toolbar may consume it too.
- Styles in `globals.css` (hex-free, using `--edge-stroke: #f8fafc` token defined there and `EDGE_STROKE` for the marker colour which cannot read CSS variables as an SVG attribute value):

```css
.react-flow__edge.react-flow__edge-canvasEdge .react-flow__edge-path { stroke: var(--edge-stroke); stroke-opacity: .6; stroke-width: 1.5; stroke-linecap: round; }
.react-flow__edge.react-flow__edge-canvasEdge:hover .react-flow__edge-path { stroke-opacity: 1; }
.react-flow__edge.react-flow__edge-canvasEdge.selected .react-flow__edge-path { stroke-opacity: 1; stroke-width: 2; }
.react-flow__connection-path { stroke: var(--edge-stroke); stroke-opacity: .6; stroke-dasharray: 4 4; }
```

- Label editor: `<input type="text" maxLength={100} style={{ width: `${clamp(value.length, 4, 24)}ch` }} className="nodrag nopan nowheel …">`, `onKeyDown` stops propagation then handles Enter/Escape; `onBlur` commits; unmount guard identical to F08 (no commit when the edge is removed). Commit: `label = value.trim().replace(/\s*\n\s*/g, ' ')`; if `label === (data.label ?? '')` → nothing; else `updateEdgeData(id, { label: label || undefined })` where `undefined` deletes the key (the mutation wrapper builds `data` by omitting undefined keys).

### Marker

`defaultEdgeOptions.markerEnd` creates one `<marker>` definition per distinct marker object (React Flow dedupes by serialised id). Edge objects in Storage never carry `markerEnd` (D-09c), keeping persisted edges to the schema-v1 minimum. Fallback (if T-001 shows controlled edges do not receive `defaultEdgeOptions`): `CanvasEdge` renders `<svg style="position:absolute;width:0;height:0"><defs><marker id="canvas-arrow" …/></defs></svg>` once via a sibling `<EdgeMarkerDefs/>` child of `<ReactFlow>` and passes `markerEnd="url(#canvas-arrow)"`.

## Domain model and TypeScript contracts

No change to canvas schema v1 (`CanvasEdge = Edge<{ label?: string }, 'canvasEdge'>`, handles required). Added constants:

```ts
// types/canvas.ts  (HandleId / HANDLE_IDS already exported by F06 — reused, not redeclared)
export const EDGE_STROKE = '#f8fafc';
export const EDGE_LABEL_MAX_LENGTH = 100;   // UX cap (input maxLength); F06's CanvasDocumentSchema bound is MAX_LABEL = 500 for edge labels too — compatible (schema ≥ UX)
```

```ts
// hooks/useCanvasConnections.ts
export function useCanvasConnections(m: CanvasMutations): {
  isValidConnection: IsValidConnection; onConnect: OnConnect;
  onReconnectStart: OnReconnectStart; onReconnect: OnReconnect; onReconnectEnd: OnReconnectEnd; edgesReconnectable: boolean }
```

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Edge `{ id, source, target, sourceHandle, targetHandle, type, data }` | Liveblocks Storage via F06 hook | Written only through `useCanvasMutations`. |
| Edge `selected` | React Flow store | Local-only (liveblocks.md §1). |
| `editing` (label input open), `reconnectSucceededRef` | Component/hook state | Ephemeral. |
| Connection-in-progress line | React Flow | Ephemeral, never synced (per-user). |
| Marker definitions | React Flow render layer | Derived from `defaultEdgeOptions`; not persisted. |

## API and integration contracts

None (no routes/actions/events). Liveblocks: edge `add`/`replace` changes; `onDelete({ nodes, edges })`.

## Security and validation

- Viewers: `*:read` token (F05) rejects writes; UI gated by `canEdit`. Forged edges with unknown handle ids or missing `type` from an editor's devtools render defensively (EC-009) and are rejected by `CanvasDocumentSchema` on autosave (F13).
- Validation performed client-side in `lib/canvas/connections.ts` is a UX rule, not a security boundary; duplicates created concurrently are accepted (EC-004).
- Label length enforced by `maxLength={100}` (UX cap, `EDGE_LABEL_MAX_LENGTH`) and by F06's `CanvasDocumentSchema` bound `MAX_LABEL = 500` at the persistence boundary (looser than the UX cap by design; see "Domain model" above).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `getSmoothStepPath` returns `[path, labelX, labelY]`; custom edges register via `edgeTypes` defined outside the component | https://reactflow.dev/learn/customization/custom-edges | checked 2026-10-22 |
| `BaseEdge` props incl. `markerEnd`, `interactionWidth` (default 20) | https://reactflow.dev/api-reference/components/base-edge | checked 2026-10-22 |
| `EdgeLabelRenderer` is a portal with no pointer events by default; add `pointerEvents: 'all'` + `nodrag`/`nopan`; position with `translate(-50%,-50%) translate(labelX, labelY)` | https://reactflow.dev/api-reference/components/edge-label-renderer , https://reactflow.dev/learn/customization/edge-labels | checked 2026-10-22 |
| `MarkerType.ArrowClosed`; `EdgeMarker { type, color, width, height, … }`; custom markers must live in `<defs>` and be referenced by id | https://reactflow.dev/api-reference/types/marker-type , https://reactflow.dev/api-reference/types/edge-marker , https://reactflow.dev/examples/edges/markers | checked 2026-10-22 |
| Reconnection: edges become reconnectable when `onReconnect` is defined; `edgesReconnectable` default true; per-edge `reconnectable`; `reconnectEdge` helper; `onReconnectStart(event, edge, handleType)`, `onReconnectEnd(event, edge, handleType, connectionState)` | https://reactflow.dev/examples/edges/reconnect-edge , https://reactflow.dev/api-reference/react-flow | checked 2026-10-22 |
| `isValidConnection` recommended on `<ReactFlow>` rather than per handle; `ConnectionMode.Loose` allows handle-to-handle regardless of type | https://reactflow.dev/api-reference/components/handle , https://reactflow.dev/api-reference/types/connection-mode | checked 2026-10-22 |
| Edges focusable; `ariaLabel` field; `edgesFocusable` default | https://reactflow.dev/learn/advanced-use/accessibility , https://reactflow.dev/api-reference/types/edge | checked 2026-10-22 |
| Hook returns `onConnect`/`onDelete`; syncs edge endpoints/handles; `onDelete` removes node + edges atomically (one undo step); `selected` local-only | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| **UNVERIFIED**: what id/type the hook's own `onConnect` assigns — avoided by D-09a. | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 (page silent) |
| **UNVERIFIED**: `defaultEdgeOptions` applied to controlled edges lacking `type`/`markerEnd` at render time — T-001; fallback D-09c. | https://reactflow.dev/api-reference/react-flow | checked 2026-10-22 (page lists the prop, not controlled-mode semantics) |
| **UNVERIFIED**: the hook persists `add`/`replace` **edge** changes (same assumption as F07 for nodes) — T-001. | — | — |
