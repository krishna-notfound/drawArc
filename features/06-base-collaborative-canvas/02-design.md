# F06 — Design

## Architecture and components

```
app/editor/[projectId]/page.tsx (server, F04)
└─ <Workspace projectId role currentUser>                     (client, F04)
   └─ <ProjectRoom projectId currentUser>                     (F05)
      └─ <FlowCanvas role>                                    (F06, 'use client')
         └─ <ReactFlowProvider>
            └─ <ReactFlow nodes edges onNodesChange onEdgesChange onConnect onDelete …>
               ├─ <Background variant="dots" gap={20}/>
               ├─ <MiniMap className="hidden md:block"/>
               ├─ <DevAddNode/>                               (dev/E2E only; removed in F07)
               └─ {children}                                  ← F07 palette, F10 control bar, F11 <Cursors/>
```

Files created: `types/canvas.ts`, `lib/canvas/schema.ts`, `lib/canvas/serialize.ts`, `components/canvas/flow-canvas.tsx`, `components/canvas/nodes/placeholder-node.tsx`, `components/canvas/edges/placeholder-edge.tsx`, `components/canvas/node-types.ts` (registry), `components/canvas/dev-add-node.tsx`, `components/canvas/viewer-badge.tsx`, `tests/fixtures/canvas/{empty,small-5-nodes,large-500-nodes,v1-small}.json`, `tests/factories.ts` (`makeCanvasDocument`). Modified: `components/editor/workspace.tsx` (F05 placeholder → `<FlowCanvas>`), `package.json`.

Server/client split: the page passes `projectId`, `role`, `currentUser`; nothing canvas-related is read on the server. All canvas state is in `useLiveblocksFlow` (client) — rule 1 of `data-ownership.md`. `lib/canvas/*` is pure TypeScript (no React, no Liveblocks) so it is importable from route handlers (F13), `trigger/` (F17), and tests.

## Domain model and TypeScript contracts

```ts
// types/canvas.ts  (frozen as schemaVersion 1 on approval — P-06-6)
import type { Edge, Node } from '@xyflow/react';

export const CANVAS_SCHEMA_VERSION = 1 as const;
export const NODE_SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];
export const NODE_COLOR_IDS = ['neutral', 'blue', 'purple', 'orange', 'red', 'pink', 'green', 'teal'] as const;
export type NodeColorId = (typeof NODE_COLOR_IDS)[number];
export const NODE_COLORS: Record<NodeColorId, { fill: string; text: string }> = {
  neutral: { fill: '#1F1F1F', text: '#EDEDED' }, blue: { fill: '#10233D', text: '#52A8FF' },
  purple:  { fill: '#2E1938', text: '#BF7AF0' }, orange: { fill: '#331B00', text: '#FF990A' },
  red:     { fill: '#3C1618', text: '#FF6166' }, pink:   { fill: '#3A1726', text: '#F75F8F' },
  green:   { fill: '#0F2E18', text: '#62C073' }, teal:   { fill: '#062822', text: '#0AC7B4' },
};
export const HANDLE_IDS = ['top', 'right', 'bottom', 'left'] as const;
export type HandleId = (typeof HANDLE_IDS)[number];
export const DEFAULT_SIZES: Record<NodeShape, { width: number; height: number }> = {
  rectangle: { width: 180, height: 80 }, pill: { width: 180, height: 64 }, circle: { width: 96, height: 96 },
  diamond: { width: 140, height: 140 }, cylinder: { width: 140, height: 110 }, hexagon: { width: 160, height: 110 },
};
export const MIN_SIZE = { width: 48, height: 32 } as const;

export interface CanvasNodeData { label: string; shape: NodeShape; color: NodeColorId }
export type CanvasNode = Node<CanvasNodeData, 'canvasNode'>;
export interface CanvasEdgeData { label?: string }
export type CanvasEdge = Edge<CanvasEdgeData, 'canvasEdge'>;

export interface PersistedNode {
  id: string; type: 'canvasNode'; position: { x: number; y: number };
  width: number; height: number; data: CanvasNodeData;
}
export interface PersistedEdge {
  id: string; type: 'canvasEdge'; source: string; target: string;
  sourceHandle: HandleId; targetHandle: HandleId; data?: CanvasEdgeData;
}
export interface CanvasDocument { schemaVersion: 1; nodes: PersistedNode[]; edges: PersistedEdge[] }
```

```ts
// lib/canvas/schema.ts
export const MAX_NODES = 2000; export const MAX_EDGES = 4000; export const MAX_LABEL = 500;
const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
export const NodeIdSchema = z.string().regex(new RegExp(`^(${NODE_SHAPES.join('|')})_${ULID}$`));
export const EdgeIdSchema = z.string().regex(new RegExp(`^e_${ULID}$`));
export const PersistedNodeSchema = z.object({
  id: NodeIdSchema, type: z.literal('canvasNode'),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  width: z.number().finite().min(MIN_SIZE.width), height: z.number().finite().min(MIN_SIZE.height),
  data: z.object({ label: z.string().max(MAX_LABEL), shape: z.enum(NODE_SHAPES), color: z.enum(NODE_COLOR_IDS) }).strict(),
}).strict();
export const PersistedEdgeSchema = z.object({
  id: EdgeIdSchema, type: z.literal('canvasEdge'), source: NodeIdSchema, target: NodeIdSchema,
  sourceHandle: z.enum(HANDLE_IDS), targetHandle: z.enum(HANDLE_IDS),
  data: z.object({ label: z.string().max(MAX_LABEL).optional() }).strict().optional(),
}).strict();
export const CanvasDocumentSchema = z.object({
  schemaVersion: z.literal(CANVAS_SCHEMA_VERSION),
  nodes: z.array(PersistedNodeSchema).max(MAX_NODES),
  edges: z.array(PersistedEdgeSchema).max(MAX_EDGES),
}).strict().superRefine(/* unique node ids, unique edge ids, edge.source/target ∈ nodes, source !== target */);
export type CanvasDocumentParsed = z.infer<typeof CanvasDocumentSchema>;   // type-test: equals CanvasDocument
export function migrate(doc: unknown): unknown;        // reads doc.schemaVersion; applies migrateV{n}ToV{n+1} in order while n < CANVAS_SCHEMA_VERSION; v1 → identity
export function validateDocument(input: unknown): { ok: true; doc: CanvasDocument } | { ok: false; error: z.ZodError };
```

```ts
// lib/canvas/serialize.ts
export function toDocument(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): CanvasDocument;
//   node → { id, type: 'canvasNode', position: {x,y}, width: n.width ?? n.measured?.width ?? DEFAULT_SIZES[shape].width, height: …, data: { label, shape, color } }
//   edge → { id, type: 'canvasEdge', source, target, sourceHandle: e.sourceHandle ?? 'right', targetHandle: e.targetHandle ?? 'left', data: label ? { label } : undefined }
//   allowlist copy: selected/dragging/measured/resizing/style/className/zIndex/handles/… are never emitted.
export function fromDocument(doc: CanvasDocument): { nodes: CanvasNode[]; edges: CanvasEdge[] };   // adds nothing beyond persisted fields
```

Hook contract consumed by F07–F10 (defined by `@liveblocks/react-flow`, re-typed here):

```ts
const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
  useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true, storageKey: 'flow', nodes: { initial: [] }, edges: { initial: [] } });
```
`storageKey: 'flow'` is a compatibility constraint: F17's server-side `mutateFlow({ client, roomId, storageKey: 'flow' })` must use the same key and the same (default) sync config, otherwise server writes land in a different subtree.

## Data and state ownership

| State | Owner | Note |
|---|---|---|
| nodes/edges (position, width, height, data, handles, endpoints) | Liveblocks Storage `flow` | via hook only; no React copy |
| `selected`, `dragging`, `measured`, `resizing` | Client memory (React Flow) | never serialised (allowlist in `toDocument`) |
| viewport | Client memory | never synced; F05 spike (c) confirms the hook does not write it |
| undo history | Client memory | automatic (D-013) |
| palette constants, default sizes, schema | Source code | versioned with the app |

No new derived copies.

## API and integration contracts

No routes or Server Actions. Room events: none emitted. Liveblocks Storage shape is managed by the hook (F05 `Storage` type). Component contract: `<FlowCanvas role={'owner'|'editor'|'viewer'}>{children}</FlowCanvas>` — children render inside `<ReactFlow>`; consumers may use `useReactFlow`, `useNodes`, `useEdges`, `useViewport`, `<Panel>`, `<ViewportPortal>`.

## Security and validation

- Threat: viewer mutation via devtools → read token (F05) rejects server-side; UI props off (P-06-4). Threat: malformed document injected into Storage by another client → renderer fallback (EC-001); persistence refuses invalid docs (F13). Threat: oversized labels/arrays → schema caps. No network calls in this feature; nothing to rate-limit.
- Validation lives in `lib/canvas/schema.ts`; render code never trusts `data` keys beyond the typed shape (fallback visuals).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `@xyflow/react` 12.12.0 latest; `13.0.0-next.0` exists without migration guide; peer `react >=17` | https://registry.npmjs.org/@xyflow/react | 2026-10-22 |
| Stylesheet must be imported; with Tailwind 4 import it **after** the tailwind stylesheet; `<ReactFlow>` needs a sized parent | https://reactflow.dev/learn/getting-started/installation-and-requirements | 2026-10-22 |
| `fitView` prop fits "nodes initially provided"; `onInit` fires when viewport initialised; `useReactFlow` must be under provider; `fitView` options `{ padding, maxZoom, duration }` | https://reactflow.dev/api-reference/react-flow ; https://reactflow.dev/api-reference/types/react-flow-instance | 2026-10-22 |
| Defaults: `panOnDrag true`, `panOnScroll false`, `zoomOnScroll true`, `minZoom 0.5`, `maxZoom 2`; `Background` dots gap 20; `MiniMap` BottomRight, `pannable/zoomable false` | https://reactflow.dev/api-reference/react-flow ; https://reactflow.dev/api-reference/components/background ; https://reactflow.dev/api-reference/components/minimap | 2026-10-22 |
| Node runtime fields `measured`, `selected`, `dragging`, `resizing`; `width`/`height` render as fixed inline size in v12 | https://reactflow.dev/api-reference/types/node ; https://reactflow.dev/learn/troubleshooting/migrate-to-v12 | 2026-10-22 |
| Memoise `nodeTypes`/`edgeTypes`, handlers, option objects; create new `data` objects | https://reactflow.dev/learn/advanced-use/performance ; https://reactflow.dev/learn/advanced-use/state-management | 2026-10-22 |
| `useLiveblocksFlow` options are mount-time; `suspense: true` ⇒ arrays always present; synced: position/width/height/data/handles/endpoints; local-only: selected/dragging/measured/resizing | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | 2026-10-22 |
| `data` keys deep-synced by default (D-014) | same | 2026-10-22 |

UNVERIFIED (resolved by F05 T-001 before this feature starts):
- `onNodesChange([{ type: 'add', item }])` persists to Storage (spike d). Fallback: the hook's documented pathway for additions if different (e.g. a returned `addNode`), applied in `DevAddNode` and reused by F07.
- Viewport never written by the hook (spike c). Fallback: none needed — we never pass viewport to the hook.
- `fitView` prop deferring until first measured node (basis of P-06-2) is inferred from the "initially provided" wording and the reference bug; P-06-2 avoids the prop entirely, so the design holds either way.
