# F08 — Design

## Architecture and components

All client-side, inside the F07 node component and as children of `<ReactFlow>` (for the toolbar). No server code.

```
components/canvas/nodes/canvas-node.tsx (F07, modified)   ─ adds <NodeResizer>, <NodeLabel>, editing state
├─ components/canvas/nodes/node-resizer.tsx (new)         ─ thin wrapper fixing props + classNames
├─ components/canvas/nodes/node-label.tsx (new)           ─ rest rendering (label | placeholder), 5-line clamp
└─ components/canvas/nodes/node-label-editor.tsx (new)    ─ textarea overlay; commit/cancel; key isolation
components/canvas/node-color-toolbar.tsx (new)            ─ <NodeToolbar nodeId={selectedIds}> + 8 swatches; rendered as a child of <ReactFlow> in the F06 island
hooks/useSelectedNodeIds.ts (new)                         ─ narrow useStore selector with shallow compare
hooks/useCanvasMutations.ts (F07, modified)               ─ adds updateNodesData(ids, patch) batched; resize needs nothing new (pipeline is React Flow's own changes)
app/globals.css (modified)                                ─ .react-flow__resize-control styles, textarea overlay, swatch glow
```

### Resize path (no custom code in the write path)

`<NodeResizer>` emits `NodeDimensionChange { id, type: 'dimensions', dimensions: { width, height }, resizing: true, setAttributes: true }` plus a `NodePositionChange` when the top/left edge moves; `onResizeEnd` sends `resizing: false` (react-flow.md §5, S44). These go to `<ReactFlow onNodesChange>` = the F06 hook handler. React Flow's `applyNodeChanges` sets `node.width/height` (because `setAttributes`) and `node.measured`; the hook syncs `width`/`height`/`position` and treats `measured`/`resizing` as local-only (liveblocks.md §1). Liveblocks collapses the gesture into one undo entry ("Dragging and resizing produce only a single action on the undo stack"). Therefore F08 adds **no** resize-specific mutation code; it only configures the resizer and verifies the outcome (AC-003/004/006).

### Label editor

```
CanvasNode ──(editing: boolean, local useState)──► NodeLabelEditor
  open:  onDoubleClick (body) | onKeyDown Enter on node root (when canEdit)
  close: commit(value) → if (value.trim() !== data.label) updateNodeData(id, { label: value.trim() }); setEditing(false); focusNode()
         cancel()      → setEditing(false); focusNode()
  guard: useEffect(() => () => { skipCommitRef.current = true }, [])   // unmount (node removed) never commits
         on blur: if (skipCommitRef.current) return;                    // EC-001
```

- The textarea is absolutely positioned over `NodeLabel` (`inset: 8px` padding box), `resize: none`, transparent background, same typography; `autoFocus` + `select()` on mount.
- Key isolation: `onKeyDown`, `onKeyUp`, `onKeyPress` call `e.stopPropagation()` **before** handling; `Enter` (no shift) → `preventDefault` + commit; `Escape` → cancel. Wheel: `nowheel` class (React Flow's `noWheelClassName`) stops zoom; `nodrag`/`nopan` stop drag/pan. Because events are stopped at the textarea, F10's window listener never sees them; F10 additionally ignores `textarea` targets (belt and braces, code-standards).
- Commit writes through `updateNodeData` (F07) which emits one `replace` change with a **new** `data` object (`{ ...node.data, label }`) — React Flow and Liveblocks both require new objects (code-standards).
- Draft buffering (D-08a): the textarea is controlled by local `draft` state; nothing is written until commit. **Fallback if the owner prefers live typing:** write `updateNodeData` on each change wrapped in `useHistory().pause()` on open and `resume()` on close (liveblocks.md §3) so the edit is still one undo step; Escape then writes the original label back.

### Colour toolbar

- `useSelectedNodeIds()` = `useStore(s => s.nodes.filter(n => n.selected).map(n => n.id), shallow)`; render `<NodeToolbar nodeId={ids} isVisible={ids.length > 0 && canEdit}>` once, as a child of `<ReactFlow>`. React Flow positions it relative to the bounds of all listed nodes; it does not scale with zoom (react-flow.md §6).
- Active colour = the colour shared by all selected nodes, else `null` (mixed). Computed by a second narrow selector returning `NodeColorId | null`.
- `updateNodesData(ids, { color })` (new in `useCanvasMutations`): emits one `onNodesChange([...ids.map(id => ({ type: 'replace', id, item: withData(id, patch) }))])` call wrapped in `room.batch()` (`useRoom()` from `@liveblocks/react/suspense`) so Liveblocks sends one message and records one undo step (liveblocks.md §2, S19). If `room.batch` cannot wrap the hook's handler synchronously (UNVERIFIED; checked in T-001), fallback: `useHistory().pause()` before and `resume()` after the single `onNodesChange` call — still one undo step; message batching then relies on Liveblocks' automatic coalescing.
- Roving tabindex: the active (or first) swatch has `tabIndex=0`, others `-1`; `ArrowLeft/Right/Up/Down` move focus with wrap; `Home`/`End` jump.

## Domain model and TypeScript contracts

No change to canvas schema v1. Contracts:

```ts
// hooks/useCanvasMutations.ts (additions)
updateNodesData(ids: string[], patch: Partial<CanvasNodeData>): void;   // batched, one undo step

// hooks/useSelectedNodeIds.ts
export function useSelectedNodeIds(): string[];
export function useSelectionColor(ids: string[]): NodeColorId | null;

// components/canvas/nodes/node-label-editor.tsx
interface NodeLabelEditorProps { nodeId: string; initial: string; color: NodeColorId; onCommit(value: string): void; onCancel(): void }

// components/canvas/nodes/node-resizer.tsx
interface CanvasNodeResizerProps { shape: NodeShape; visible: boolean }   // maps to NodeResizer { minWidth: 48, minHeight: 32, keepAspectRatio: shape === 'circle', isVisible: visible, handleClassName: 'canvas-resize-handle', lineClassName: 'canvas-resize-line' }

export const LABEL_MAX_LENGTH = 200;   // types/canvas.ts — UX cap enforced by the textarea; F06's CanvasDocumentSchema bound is MAX_LABEL = 500 (looser boundary limit, so remote/agent data up to 500 still validates and renders)
```

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| `width`, `height`, `position` after resize | Liveblocks Storage (via hook) | Written by React Flow's own changes through `onNodesChange`. |
| `data.label`, `data.color` | Liveblocks Storage | Written by `updateNodeData`/`updateNodesData`; per-key LWW (D-014). |
| `editing`, `draft` | Component state (client memory) | Never synced; lost on unmount (EC-001/EC-010). |
| `selected`, `resizing`, `measured` | React Flow store (client memory) | Local-only (liveblocks.md §1). |
| Toolbar visibility, active swatch | Derived from React Flow selection via narrow selectors | No stored copy. |

## API and integration contracts

None (no routes/actions/events). Liveblocks: `replace` node changes; `room.batch()` for multi-node colour.

## Security and validation

- Viewers: UI absent (`canEdit` false), `elementsSelectable={false}` (F06/AC-015) so nothing can even be selected, and the `*:read` token rejects writes (F05). A forged `replace` with a 10 kB label from an editor is accepted by Liveblocks (2 MB LiveObject limit) but rejected by `CanvasDocumentSchema` (`MAX_LABEL = 500`, F06) on autosave (F13); the textarea `maxLength={200}` is the UX guard.
- `data.color` only ever comes from `NODE_COLOR_IDS` bound to the swatch; unknown colours from remote data render as `neutral` with `logger.warn` (defensive, F07 `ShapeRenderer`).
- No new input crosses a server boundary.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `NodeResizer` props: `minWidth`/`minHeight` (default 10), `keepAspectRatio`, `isVisible`, `handleClassName`, `lineClassName`, `onResizeStart/onResize/onResizeEnd`; 12.12.0 always fires `onResizeEnd` after `onResizeStart` | https://reactflow.dev/api-reference/components/node-resizer , https://reactflow.dev/whats-new | checked 2026-10-22 |
| Resize emits `NodeDimensionChange { dimensions, resizing, setAttributes }` (+ `NodePositionChange`); `applyNodeChanges` sets `node.width/height` when `setAttributes` and updates `measured`/`resizing` | https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/additional-components/NodeResizer/NodeResizeControl.tsx , https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/utils/changes.ts | checked 2026-10-22 |
| v12: explicit `width`/`height` are fixed inline sizes; `measured` holds measurements | https://reactflow.dev/learn/troubleshooting/migrate-to-v12 | checked 2026-10-22 |
| `NodeToolbar` `nodeId: string \| string[]`, `isVisible`, `position`, `offset` (10), `align`; hidden for multi-selection unless `isVisible`; does not scale with viewport | https://reactflow.dev/api-reference/components/node-toolbar | checked 2026-10-22 |
| No built-in text editor; `nodrag`/`nowheel`/`nopan` class names; built-in Backspace/arrow handling means editors must stop propagation | https://reactflow.dev/learn/customization/custom-nodes , https://reactflow.dev/api-reference/react-flow , https://reactflow.dev/learn/advanced-use/accessibility | checked 2026-10-22 |
| Performance: do not derive selection by filtering the full `nodes` array in components; use narrow store selectors | https://reactflow.dev/learn/advanced-use/performance | checked 2026-10-22 |
| Hook syncs `width`/`height`/`data`; `selected/dragging/measured/resizing` local-only; "Dragging and resizing produce only a single action on the undo stack"; `updateNode` is a no-op for a missing id | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| Same key edited concurrently: last change to reach the server wins, whole value | https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync | checked 2026-10-22 |
| Undo is per client and does not rebase ("can overwrite someone's newer value"); `history.pause()/resume()` collapse changes into one step; `room.batch()` = one message + one undo step | https://liveblocks.io/docs/api-reference/liveblocks-react , https://liveblocks.io/docs/api-reference/liveblocks-client | checked 2026-10-22 |
| **UNVERIFIED**: `room.batch()` wrapping the hook's `onNodesChange` yields one undo step (fallback: `history.pause/resume`). Verified in T-001. | — | — |
| **UNVERIFIED**: `useStore` shallow-compare selector returning a new array each time — use `useStore(selector, shallow)` from `@xyflow/react` (`shallow` re-exported from zustand) — confirm export name in T-004. | — | — |
