# F22 — Design

## Architecture and components

Client-side except the schema, which is pure TypeScript shared by the F13 route, the seed function and the hook (no React, no Liveblocks imports in `lib/canvas/*`). Dependency direction unchanged: `components/canvas/*` → `hooks/*` → `lib/canvas/*` → `types/canvas.ts`.

```
types/canvas.ts (modified)                 ─ v2 constants and types (below); NODE_SHAPES unchanged
lib/canvas/schema.ts (modified)            ─ discriminated union, reserved fields, edge style, migrateV1ToV2, superRefine additions
lib/canvas/color.ts (new)                  ─ isHexColor, resolveColor, textContrastOk, contrastRatio (pure; ONE module shared with F08 v2, which adds normaliseColor)
lib/canvas/ids.ts (modified)               ─ newNodeId(kind: NodeKind)
lib/canvas/text-measure.ts (new)           ─ measureText(mirror, { text, size, bold, width? }) → { width, height }; fontsReady()
lib/canvas/shortcuts.ts (modified, interim)─ 'addText' | 'addSticky' (moved to the registry by the F10 upgrade)
hooks/useCanvasMutations.ts (modified)     ─ addNodeOfKind(kind, position); commitTextNode(id, patch) = one replace (label+width+height[+autoWidth])
components/canvas/shape-palette.tsx (mod.) ─ two extra items; PALETTE_ITEMS = [...NODE_SHAPES, 'text', 'sticky']
components/canvas/shape-drag-ghost.tsx (mod.)─ text/sticky previews
components/canvas/nodes/canvas-node.tsx (mod.)─ kind dispatch (D-22a); memo wrapper unchanged
components/canvas/nodes/text-node.tsx (new)   ─ auto-width/fixed-width text, side-only resizer, no handles
components/canvas/nodes/sticky-node.tsx (new) ─ filled note, F08 resizer (75 min), NodeHandles, auto-grow
components/canvas/nodes/reserved-kind-node.tsx (new) ─ placeholder for line/freehand/frame/image
components/canvas/nodes/text-mirror.tsx (new) ─ hidden measuring element mounted only while editing
(no toolbar component)                     ─ text options are edited in F08 v2's node-properties-toolbar.tsx (FR-016); F22 exports TEXT_OPTION_KINDS / DEFAULT_TEXT only
app/globals.css (modified)                 ─ .canvas-text-node, .canvas-sticky-node, size classes
```

### Kind dispatch (D-22a)

`CanvasNodeImpl` reads `data.shape`; `knownVisuals` becomes `kindOf(data)`: known kind → that kind; unknown → `'rectangle'` + one warning (F07 behaviour kept). Shapes keep the current body; `text`/`sticky`/reserved kinds render their component with the same `NodeProps`. The `React.memo` wrapper, `nodeTypes = { canvasNode }` and `type: 'canvasNode'` are unchanged.

### Text node lifecycle

```
create (T / palette)  → addNodeOfKind('text', pos, init?): add {label: init?.label ?? '', autoWidth:true, width:24, height:20}; select; TextNode mounts with editing=true (unless a non-empty init.label was given — F10 v2 paste path, which then commits the measured size itself) (flag passed via a module-level "openEditorFor" ref set by the mutation, read once on mount)
typing               → textarea value → mirror.measure(draft) → local style width/height (auto) or height (fixed); no writes
commit (Enter/blur)  → label = trim(draft)
                       label === ''                       → onDelete({ nodes:[node], edges:[] })            (FR-013)
                       else size = measure(label)         → commitTextNode(id, { label, width, height })    (one replace)
Escape               → neverHadText ? onDelete(...) : close without write                                    (D-053 + FR-013)
resize end (side)    → commitTextNode(id, { autoWidth:false, width, height: measure(label, width).height })  (FR-011)
unmount while editing→ skipCommitRef (F08 FR-010) — also skips the delete
```

`measureText` renders into a hidden `<span>` (`position:absolute; visibility:hidden; white-space: pre | pre-wrap; width: auto | <px>`) with the same classes as the rest label and returns `ceil(getBoundingClientRect())` plus padding; it is DOM-based on purpose (research 01§X10: canvas `measureText` fails under some privacy modes). The mirror lives inside the node so it inherits the viewport transform; results are divided by `getZoom()` to get flow units (VERIFIED: `useReactFlow().getZoom` exists, F07). `fontsReady()` awaits `document.fonts.ready` once and caches the promise.

Remote clients: `width`/`height` arrive via the hook; the text content is rendered at that size with `white-space: pre` (auto) or `pre-wrap` (fixed) and `overflow: visible`, so a sub-pixel font difference never clips.

### Sticky note

Same editor; on commit `height = max(height, measure(label, width - 24).height + 24)`; `replace` carries `label` (+ `height` if it changed). Handles: `NodeHandles` as F07. Resizer: `CanvasNodeResizer` with `minWidth=minHeight=75` (prop added to the F08 wrapper, default 48 × 32).

### Toolbars and shortcuts

- Text options: no F22 toolbar (validation ruling 2026-10-28). F08 v2's properties toolbar (F08 FR-024) shows its text groups when every selected kind is in `TEXT_OPTION_KINDS`, derives the current value from each node's effective `data.text` (`data.text ?? DEFAULT_TEXT[kind]`, else mixed) and writes `updateNodesData(ids, { text: { ...effective, size } })` — the whole `text` object, so per-key LWW applies to `data.text` as one value ("Verified facts" below: nested depth UNVERIFIED; writing the whole object avoids depending on it). `TextNode` / `StickyNode` only read `data.text`.
- Shortcuts: `matchShortcut` gains `if (!mod && !shift && key === 't') return 'addText'` / `'n' → 'addSticky'`; `MUTATING` gains both; `formatKeys` → `T` / `N`; cheat-sheet rows "Add text — T", "Add sticky note — N". The handler in `canvas-ergonomics.tsx` calls `addNodeOfKind(kind, viewportCentre)` and, for text, opens the editor. Ordering rule (FR-008): if F10 v2's registry is on `main` first, the two entries are registered there (`RESERVED_CHORDS` releases `t`/`n` to the bindings) and `matchShortcut` is not touched; otherwise F10 v2 T-009 migrates them. The registry's duplicate-binding test guards both.

## Domain model and TypeScript contracts

Canvas schema v2 (replaces the v1 block in `context/domain-model.md`; frozen at F22 approval).

```ts
// types/canvas.ts
export const CANVAS_SCHEMA_VERSION = 2 as const;
export const NODE_SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'] as const;   // unchanged (F07 palette)
export const NODE_KINDS = [...NODE_SHAPES, 'text', 'sticky', 'line', 'freehand', 'frame', 'image'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export const HANDLE_KINDS = [...NODE_SHAPES, 'sticky', 'image'] as const;          // may be edge endpoints
export const TEXT_OPTION_KINDS = [...NODE_SHAPES, 'text', 'sticky'] as const;     // kinds whose data.text the F08 v2 properties toolbar edits (reserved kinds excluded)

export type HexColor = `#${string}`;                                               // validated as /^#[0-9a-fA-F]{6}$/
export type NodeColor = NodeColorId | HexColor;                                    // D-063

export const TEXT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export const TEXT_SIZE_PX = { s: 12, m: 14, l: 20, xl: 28 } as const;
export type TextOptions = { size: 's' | 'm' | 'l' | 'xl'; align: 'left' | 'center' | 'right'; valign: 'top' | 'middle' | 'bottom'; bold: boolean };
export type BorderOptions = { style: 'none' | 'solid' | 'dashed' | 'dotted'; width: 1 | 2 | 3 };
export const DEFAULT_TEXT: Record<NodeKind, TextOptions>   // shapes/frame/image: center/middle; text/sticky: left/top; size 'm', bold false
export const DEFAULT_BORDER: Record<NodeKind, BorderOptions> // shapes: solid 1; text/sticky/line/freehand/frame/image: none 1
export const TEXT_MAX_LENGTH = 500;                            // = MAX_LABEL; LABEL_MAX_LENGTH (200) stays for the six shapes

type CommonData = { label: string; color: NodeColor; text?: TextOptions; border?: BorderOptions;
                    locked?: boolean; groupId?: string; order?: string; href?: string };
export type ShapeData    = CommonData & { shape: NodeShape };
export type TextData     = CommonData & { shape: 'text'; autoWidth: boolean };
export type StickyData   = CommonData & { shape: 'sticky' };
export type LineData     = CommonData & { shape: 'line'; points: [number, number][]; stroke?: StrokeStyle };            // F28: 2–100 points, node-relative
export type FreehandData = CommonData & { shape: 'freehand'; points: [number, number, number][]; strokeWidth: number }; // F21: ≤ 2000 points, 2–16
export type FrameData    = CommonData & { shape: 'frame'; clip: boolean };                                                // F23: label = title
export type ImageData    = CommonData & { shape: 'image'; image: { fileId: string; status: 'pending' | 'saved' | 'error'; natural: { width: number; height: number } } }; // F24
export type StrokeStyle  = { dash: 'solid' | 'dashed' | 'dotted'; width: 1 | 2 | 3 | 4; markerStart: MarkerKind; markerEnd: MarkerKind };
export type MarkerKind   = 'none' | 'arrow' | 'arrowClosed' | 'circle' | 'diamond' | 'bar';   // arrow/arrowClosed = React Flow MarkerType (VERIFIED); others custom <defs> (F09 upgrade)
export type CanvasNodeData = ShapeData | TextData | StickyData | LineData | FreehandData | FrameData | ImageData;

export type EdgeStyle = { path: 'smoothstep' | 'step' | 'straight' | 'bezier'; dash: 'solid' | 'dashed' | 'dotted'; width: 1 | 2 | 3; markerStart: MarkerKind; markerEnd: MarkerKind };
export const DEFAULT_EDGE_STYLE: EdgeStyle = { path: 'smoothstep', dash: 'solid', width: 2, markerStart: 'none', markerEnd: 'arrowClosed' }; // = today's F09 rendering (1.5 px CSS rounds to the nearest allowed value; F09 upgrade keeps CSS until it reads `style`)
export type CanvasEdgeData = { label?: string; style?: EdgeStyle };

export const DEFAULT_SIZES: Record<NodeKind, { width: number; height: number }>  // + text 24×20 (minimum; grows on commit), sticky 250×250, line 100×100, freehand 100×100, frame 400×300, image 200×150
export const MIN_SIZES: Record<NodeKind, { width: number; height: number }>      // shapes/line/freehand/frame/image 48×32; text 24×20; sticky 75×75

export interface PersistedNode { id; type: 'canvasNode'; position; width; height; data: CanvasNodeData; parentId?: string; extent?: 'parent' }
export interface CanvasDocument { schemaVersion: 2; nodes: PersistedNode[]; edges: PersistedEdge[] }
```

Zod (`lib/canvas/schema.ts`): `NodeIdSchema` regex uses `NODE_KINDS`; `ColorSchema = z.union([z.enum(NODE_COLOR_IDS), z.string().regex(/^#[0-9a-fA-F]{6}$/)])`; `TextOptionsSchema`, `BorderSchema`, `EdgeStyleSchema` strict objects; `GroupIdSchema = /^g_[ULID]$/`; `OrderSchema = /^[0-9A-Za-z]{1,64}$/`; `HrefSchema = z.string().max(2048).regex(/^https?:\/\//)`; `PersistedNodeSchema = z.discriminatedUnion('shape', …)` on `data` wrapped by a node object whose `width/height` minimums come from `MIN_SIZES[kind]` (via `superRefine` on the node), `parentId: NodeIdSchema.optional()`, `extent: z.literal('parent').optional()`. `superRefine` on the document adds: edge endpoints ∈ `HANDLE_KINDS`; `parentId` must reference a `frame`; a `frame` has no `parentId`; `groupId` sharing is not validated (F23). Caps unchanged (`MAX_NODES` 2000, `MAX_EDGES` 4000, `MAX_LABEL` 500).

```ts
export function migrateV1ToV2(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...structuredClone(doc), schemaVersion: 2 };    // pure stamp: every v2 field is optional (D-22d)
}
const MIGRATIONS = { 1: migrateV1ToV2 };
```

Fixtures: keep `v1-small.json` (input); add `v2-small.json` (= migrated v1-small) and `v2-kinds.json` (freeze fixture: one node per kind, `parentId` child of the frame, hex colour, `data.text`/`border`/`locked`/`groupId`/`order`/`href` set on one node, one styled edge with `markerStart`). Templates: `buildDocument` stamps `CANVAS_SCHEMA_VERSION`; fixture JSONs regenerated (only the version digit changes). `large-500-nodes.json` and `makeCanvasDocument` stamp 2. F17's `DesignPlan` validator (drafted) must keep emitting only `NODE_SHAPES`; F19's envelope carries `schemaVersion` and runs `migrate` (already in its draft).

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Node `data.*`, `width`, `height`, `position`, `parentId`, `extent` | Liveblocks Storage via the F06 hook | Written only through `useCanvasMutations`; `parentId`/`extent` sync is UNVERIFIED (below) — F23 verifies before use; F22 only validates them. |
| Editing draft, mirror measurements, `neverHadText` | Component state | Never synced; lost on unmount. |
| Effective text/border options | Derived (`data.text ?? DEFAULT_TEXT[kind]`) | No stored copy; defaults live in `types/canvas.ts`. |
| Snapshot `schemaVersion` | Blob + `Project.canvasSchemaVersion` (F13) | Becomes 2 on the next PUT; GET/seed migrate on read. |

## API and integration contracts

No routes, actions or room events. Liveblocks: `add`, `replace`, `remove` node changes through the existing handlers. F13 `PUT /api/projects/[id]/canvas` accepts v1 (migrated) and v2 bodies, rejects v3 — unchanged code, new fixture in `tests/integration/api/canvas-route.test.ts` (one case).

## Security and validation

- Every new field is bounded (lengths, enums, regexes, point counts) and `.strict()`; the document stays ≤ 4 MB (F13) — `line`/`freehand` point caps keep a worst-case 2000-node document under it (F21 G-3 budget reused).
- `href` is validated as `https?://` only (no `javascript:`); F22 never renders it (F08 upgrade renders it as a link with `rel="noopener noreferrer"`).
- Hex colours are never injected as CSS text: `resolveColor` returns a validated `#rrggbb` or the `neutral` pair; the component sets `style={{ background: fill }}` from that value only.
- Viewers: UI absent, mutation guard, `*:read` token (F05). No new server boundary.

## Verified library facts this design relies on

| Fact | Source | Date checked |
|---|---|---|
| `NodeResizer` props `minWidth`, `minHeight`, `keepAspectRatio`, `isVisible`, `handleClassName`, `lineClassName`, `autoScale`; `ResizeControlVariant` and `ControlLinePosition` exported for side-only controls (`NodeResizeControl`) | `node_modules/@xyflow/react/dist/esm/additional-components/NodeResizer/types.d.ts`, `index.d.ts` | VERIFIED 2026-10-28 |
| `NodeToolbar` `nodeId: string \| string[]`, `isVisible`, `align`, `offset` | `…/NodeToolbar/types.d.ts` | VERIFIED 2026-10-28 |
| Node fields `parentId?`, `extent?: 'parent' \| …`, `zIndex?`, `draggable?`, `selectable?`, `connectable?`, `ariaLabel?`, `width?/height?` | `node_modules/@xyflow/system/dist/esm/types/nodes.d.ts` | VERIFIED 2026-10-28 |
| Edge `markerStart?/markerEnd?: EdgeMarkerType`, `EdgeMarker`, `MarkerType` (Arrow, ArrowClosed), `interactionWidth` | `…/system/dist/esm/types/edges.d.ts`, react `index.d.ts` | VERIFIED 2026-10-28 |
| Path helpers `getSmoothStepPath` (`borderRadius` → 0 = step), `getStraightPath`, `getBezierPath`, `BaseEdge`, `EdgeLabelRenderer` | `…/system/dist/esm/utils/edges/*.d.ts`, react `index.d.ts` | VERIFIED 2026-10-28 |
| `useStore`, `useStoreApi`, `useReactFlow`, `useUpdateNodeInternals`, `useNodesData`, `Handle` exported; `elevateNodesOnSelect` prop; `ZIndexMode` type | react `index.d.ts`, `types/component-props.d.ts`, system `general.d.ts` | VERIFIED 2026-10-28 |
| Zod 4.6.7: `z.discriminatedUnion`, `.strict()`, `.superRefine`, numbers reject NaN/Infinity | `node_modules/zod/package.json`, existing `schema.ts` | VERIFIED 2026-10-28 |
| `@liveblocks/react-flow` 3.24.4 syncs `data`, `width`, `height`, `position`; `selected/dragging/measured/resizing` local-only; one `onNodesChange` call = one batch | F08 status rulings; liveblocks docs checked 2026-10-22 | VERIFIED (prior) |
| **UNVERIFIED**: whether `@liveblocks/react-flow` syncs top-level `parentId`/`extent` and how deep `data` sub-objects are converted to `LiveObject`s (conflict granularity of `data.text`). Fallback: F22 writes whole `data.text` objects; F23 verifies `parentId` sync in its spike before frames ship. | — | — |
| **UNVERIFIED**: `document.fonts.ready` resolves before first paint of a node under `next/font` self-hosting (expected). Fallback: measure, then re-measure once on `fonts.ready` and write again only if the size differs by > 1 px. | — | — |
