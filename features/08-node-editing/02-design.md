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

---

## v2 — richer node editing (2026-10-28)

### Architecture and components (v2)

All client-side. F22 (schema v2) must be merged first: F08 v2 consumes its types (`TextOptions`, `BorderOptions`, `NodeColor`, `DEFAULT_TEXT`, `TEXT_SIZE_PX`), its `lib/canvas/color.ts` (`resolveColor`, `textContrastOk`, `isHexColor`) and its `lib/canvas/text-measure.ts` (`measureText(mirror, { text, size, bold, width })`), and reads its `TEXT_OPTION_KINDS` predicate (six shapes, `text`, `sticky`) to decide where the toolbar's text groups apply. Nothing is redefined here.

```
components/canvas/nodes/node-resizer.tsx (modified)        ─ Shift/Alt from event.sourceEvent; dynamic minHeight; history pause/resume + fit write at end
components/canvas/nodes/node-label.tsx (modified)          ─ typography from data.text (size/align/valign/bold); line-clamp removed, overflow hidden kept
components/canvas/nodes/node-label-editor.tsx (modified)   ─ same typography; Ctrl/⌘+B toggles a local `bold` draft; onCommit(value, { bold })
components/canvas/nodes/shape-renderer.tsx (modified)      ─ border style/width (CSS + SVG dasharray); fill/text via resolveColor
components/canvas/nodes/canvas-node.tsx (modified)         ─ commit = one replace change { data, height: fit }
components/canvas/node-properties-toolbar.tsx (renamed from node-color-toolbar.tsx) ─ the single properties toolbar for every kind (validation 2026-10-28): colour(+More) · border · text (size/bold/align/valign); F22 ships no toolbar
components/canvas/node-hex-input.tsx (new)                 ─ hex field + recent list (localStorage), validation, aria-invalid
lib/canvas/fit-height.ts (new)                             ─ fitHeight(node, mirror): number — pure except for the DOM read inside measureText
hooks/useSelectedNodeIds.ts (modified)                     ─ useSelectionValue<T>(ids, pick: (data) => T): T | MIXED  (generalises useSelectionColor)
hooks/useCanvasMutations.ts (modified)                     ─ replaceNodes(items) batched; updateNodesData gains an optional per-id patch fn for fitted heights
app/globals.css (modified)                                 ─ toolbar divider/mixed badge; dashed outline tokens
```

### Resize modifiers (FR-015, FR-016, D-08f)

```
onResizeStart(e)  → shift = e.sourceEvent.shiftKey; alt = e.sourceEvent.altKey; history.pause()
onResize(e, p)    → setShift(e.sourceEvent.shiftKey); setMinHeight(max(32, fitHeight({ ...node, width: p.width })))
                    [P3] if alt: trigger [{type:'position', id, position:{x: start.x - dw/2, y: start.y - dh/2}}, {type:'dimensions', id, dimensions:{w: start.w + 2dw, h: start.h + 2dh}, resizing:true, setAttributes:true}]
onResizeEnd(e, p) → h = clamp(p.height, fitHeight(node@p.width), 480); if h > p.height → trigger [{type:'dimensions', id, dimensions:{width:p.width, height:h}, setAttributes:'height'}]; history.resume(); setShift(false)
<NodeResizer keepAspectRatio={shape === 'circle' || shift} minHeight={minHeight} …v1 props />
```

- The React `ResizeControl` re-runs `resizer.update({ keepAspectRatio, boundaries… })` in an effect keyed on those props, and the system drag handler reads `params.keepAspectRatio` / `params.boundaries` on every pointer move, so a state change applies on the next move (one-move lag, sub-frame). `startValues.aspectRatio` is captured at drag start, which fixes the ratio semantics in FR-015.
- No window listener: Shift outside a drag is never observed by F08, so F10's `selectionKeyCode="Shift"` is untouched (01§T4 risk resolved).
- `history.pause()/resume()` bracket the gesture so the post-gesture fit write joins the same undo step (Liveblocks docs; the hook's own gesture collapsing is unaffected). The pause/resume-around-the-hook interaction is VERIFIED in T-008 before anything else is built.

### Auto-grow (FR-017, FR-018, D-08e)

- `fitHeight(node, mirror) = clamp(MIN_SIZES[kind].height, measureText(mirror, { text: label, size, bold, width: node.width − 2·padding − 2·borderWidth }).height + 16 + 2·borderWidth, AUTO_GROW_MAX_HEIGHT)` (padding 2 × 8 px for the six shapes; F22's `text`/`sticky` keep their own commit-time sizing — F22 FR-010/FR-015 — and are not fitted by F08); `AUTO_GROW_MAX_HEIGHT = 480` in `types/canvas.ts`. The mirror is F22's single hidden element with the label typography; measurement is a synchronous DOM read (01§X10: never canvas `measureText`).
- Label commit: `canvas-node.tsx` builds one `replace` item `{ ...node, height: max(node.height, fitHeight(nodeWithNewLabel)), data: { ...data, label, text? } }` → `replaceNode(item)`. One change, one undo step, no post-render measurement, no second write. Only the committing client writes (EC-017).
- Toolbar text-size/bold: `updateNodesData(ids, patchFn)` where `patchFn(node)` returns `{ data: {...}, height: max(node.height, fitHeight(...)) }`; one change set (EC-020).
- Never shrinks automatically; the resizer `minHeight` (FR-018) stops manual clipping. Persisted `height` is always the rendered height, so F13 snapshots, SSR sizing and edge anchors are unchanged; the F06 `CanvasDocumentSchema` bound `height ≥ 32` holds and no upper bound exists.
- Interplay: a remote client receives only the final `height`; it measures nothing. v1 documents without `data.text` measure with the defaults, so their fitted height equals what v1 rendered (no write until a user acts, EC-021).

### Text options, border, colour (FR-019 – FR-023)

- Effective options = `{ ...DEFAULT_TEXT[shape], ...data.text }`; writes send the **whole** `text` object (F22 rule: nested per-key LWW depth is UNVERIFIED, so `data.text` is treated as one value). `data.border` likewise.
- Label column: `display:flex; flex-direction:column; justify-content:{valign}` on the shape's content box; label and textarea get `font-size: TEXT_SIZE_PX[size]`, `font-weight: bold ? 600 : 400`, `text-align: align`. `LABEL_TYPOGRAPHY` becomes `labelTypography(text)` returning the class/style pair used by both rest and editor (FR-014 contract).
- Border: CSS shapes → `border: {w}px {style} {colour}` (`none` → `border-color: transparent` at rest, keeping the box size stable). SVG shapes → `stroke-width={w}`, `stroke-dasharray` `6 4` (dashed) / `2 4` (dotted, schema-only) / none; `vector-effect: non-scaling-stroke` (v1). Selected: colour `--accent-primary`, width `max(2, w)`, style kept, `none` → solid.
- Colour: `resolveColor(data.color)` → `{ fill, text, custom }`; `knownVisuals` accepts hex via `isHexColor`. WCAG relative luminance: `lin(c) = c/255 ≤ 0.03928 ? c/255/12.92 : ((c/255 + 0.055)/1.055)^2.4`; `L = 0.2126·lin(r) + 0.7152·lin(g) + 0.0722·lin(b)`; `contrast = (L_hi + 0.05)/(L_lo + 0.05)`. **Proof for D-08g (pure `#FFFFFF` / `#000000`):** the fill luminance minimising `max(contrast(white), contrast(black))` solves `1.05/(L+0.05) = (L+0.05)/0.05` → `L = 0.179`, where both equal **4.58 ≥ 4.5**: every hex is legible and `textContrastOk` never fails. With the previously drafted pair `#F0F0F4` (L ≈ 0.874) / `#111114` (L ≈ 0.006) the same minimum would be ≈ **4.08** (fills near L 0.18 such as `#757575` would need refusing), which is why it was dropped. **Resolved at validation (2026-10-28, O-v2-3): the pure pair is the shared implementation in `lib/canvas/color.ts` (F22 FR-004).** `textContrastOk(kind, hex)` remains only for the `text` kind (the hex is the text colour on `--bg-base`), which is the one case the hex input refuses (FR-023).
- Palette preference: `normaliseColor(hex)` lower-cases and returns the palette id whose `fill` matches, else the hex. Recent list: `localStorage['drawarc:recent-colors']`, JSON array ≤ 5, hex only, read/written in `try/catch`; never in Liveblocks (03§F-40: per-user only).

### Properties toolbar (FR-024, FR-025)

- `useSelectionValue(ids, pick)` runs `pick(effectiveData)` per selected node via `nodeLookup`; all equal → value, else `MIXED`. Groups: colour, border style, border width, text size, bold, align, valign. Group visibility (FR-024): colour always; border groups when every selected kind is one of the six shapes; text groups when every selected kind ∈ F22 `TEXT_OPTION_KINDS`. Each group is a `role="radiogroup"` (bold: `aria-pressed` button; width: cycling button) reusing v1's `nextIndex` roving logic; a `—` badge (`aria-label="Mixed"`) appears per mixed group.
- One `<NodeToolbar nodeId={ids} isVisible position={Position.Top} offset={12} align="center" className="nodrag nopan">`; the "More colours" row expands inside it (no Popover: `components/ui` has none and `@radix-ui/react-popover` would need owner approval).
- The v1 rule stands: a toolbar pointerdown blurs the textarea and commits the draft first (EC-008), then the option applies; the hex input is an ordinary focus target.
- Every action → one `updateNodesData(ids, patch | patchFn)`; `patchFn(node) => Partial<CanvasNode>` supplies per-node fitted heights; still one `triggerNodeChanges` call (v1 ruling: one change call = one undo step).

### Data and state ownership (v2)

| State | Owner | Notes |
|---|---|---|
| `data.text`, `data.border`, `data.color` (id or hex) | Liveblocks Storage | Whole-object writes; per-key LWW between `text` / `border` / `color` (EC-023). |
| Fitted `height` | Liveblocks Storage | Written only by the acting client, in the same change / history step as its cause. |
| Shift/Alt state, `minHeight`, bold draft in the editor | Component state | Exists only during a drag / an open editor. |
| Recent colours | `localStorage` (per browser) | Never synced; absent in private mode. |

### Security and validation (v2)

No server boundary changes. F22's Zod schema (v2) validates `text`, `border`, hex `color` and `height ≥ 32` at autosave/import; the toolbar only writes enum values and normalised hex; the hex input refuses anything but 3/6-digit hex. Viewer gates unchanged (FR-013/FR-027).

### Verified library facts this design relies on (v2)

| Fact | Source | Date checked |
|---|---|---|
| `NodeResizerProps` (@xyflow/react 12.12.0): `keepAspectRatio`, `minWidth/minHeight/maxWidth/maxHeight`, `shouldResize`, `onResizeStart/onResize/onResizeEnd`, `autoScale`, `handleStyle/lineStyle`, `isVisible` — **VERIFIED** | `node_modules/@xyflow/react/dist/esm/additional-components/NodeResizer/types.d.ts` | 2026-10-28 |
| `OnResize(event: D3DragEvent, params: { x, y, width, height, direction })`; `event.sourceEvent` is the native pointer event (modifier keys readable) — **VERIFIED** | `@xyflow/system@0.0.83 dist/esm/xyresizer/types.d.ts`; `@types/d3-drag` (`sourceEvent`) | 2026-10-28 |
| `ResizeControl` re-runs `resizer.update({ … keepAspectRatio, boundaries … })` in a `useEffect` keyed on those props; the drag handler reads `params.keepAspectRatio` / `params.boundaries` on each move; `startValues.aspectRatio` is fixed at start — **VERIFIED** (prop changes apply mid-drag) | `@xyflow/react dist/esm/index.js` ≈ L4960–4990; `@xyflow/system dist/esm/index.js` L3249–3255, L3430–3436, L3526 | 2026-10-28 |
| `NodeDimensionChange.setAttributes?: boolean \| 'width' \| 'height'` — **VERIFIED** | `@xyflow/system dist/esm/types/changes.d.ts` L7 | 2026-10-28 |
| A `dimensions` change emitted outside a gesture (`setAttributes:'height'`, no `resizing`) is synced by `@liveblocks/react-flow` 3.24.4 as `height` — **UNVERIFIED** (dist minified; v1 verified only the in-gesture path). Fallback: a `replace` change (v1 path). Settled in T-008. | — | — |
| `history.pause()` at `onResizeStart` and `resume()` after the fit write collapse gesture + extra write into one undo step without breaking the hook's own collapsing — **UNVERIFIED**; fallback: accept a second undo step for the resize-end fit (recorded in status). Settled in T-008. | https://liveblocks.io/docs/api-reference/liveblocks-react (`pause`/`resume`, checked 2026-10-22) | — |
| F22's `measureText` mirror returns the wrapped height for a given width — relies on F22's own verification (its mirror AC). | F22 02-design | — |
