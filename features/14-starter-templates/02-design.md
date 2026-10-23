# F14 — Design

## Architecture and components

```
lib/canvas/templates.ts (new)                      ─ CanvasTemplate, CANVAS_TEMPLATES, instantiateTemplate, layout helpers (no React)
lib/canvas/layout-check.ts (new)                   ─ pure: nodeRect, rectsOverlap(a, b, margin), findOverlaps(nodes, margin) — reused by F17 (agent output check)
components/editor/import-template-dialog.tsx (new) ─ Dialog + card grid + confirmation AlertDialog
components/editor/template-preview.tsx (new)       ─ pure SVG preview
components/editor/editor-navbar.tsx (F04, modified) ─ renders <ImportTemplateButton/> when canEdit
hooks/useImportTemplate.ts (new)                   ─ batch replace, broadcast, fitView
components/canvas/canvas-replaced-toast.tsx (new)  ─ useEventListener(CANVAS_REPLACED) → toast (sonner)
components/ui/sonner.tsx (generated)               ─ npx shadcn add sonner; <Toaster/> mounted in app/layout.tsx (or the workspace layout) if not already
types/liveblocks.config.ts (F05)                    ─ RoomEvent CANVAS_REPLACED { byUserId, templateName? } already declared by F05 per domain-model.md; nothing to extend
tests/fixtures/canvas/templates/*.json (generated) ─ one per template
```

Dependency direction holds: `components/editor` → `hooks` → `lib/canvas` → `types`. The navbar is a client island already (F04); the Import button is a client component that renders the dialog lazily (`next/dynamic` not required; the dialog is small).

### Import sequence (`useImportTemplate`)

```ts
const room = useRoom(); const self = useSelf(); const rf = useReactFlow(); const store = useStoreApi();
const m = useCanvasMutations(); const broadcast = useBroadcastEvent();

importTemplate(template: CanvasTemplate) {
  if (!m.canEdit) return;
  const { nodes, edges } = store.getState();                       // current canvas, read at call time
  const instance = instantiateTemplate(template);                   // fresh ids
  room.batch(() => {                                                // one message, one undo step (liveblocks.md §2)
    if (nodes.length || edges.length) m.onDelete({ nodes, edges }); // atomic cascade (liveblocks.md §1)
    m.addNodes(instance.nodes);
    instance.edges.forEach(m.addEdge);
  });
  broadcast({ type: 'CANVAS_REPLACED', byUserId: self.id, templateName: template.name });
  requestAnimationFrame(() => rf.fitView({ duration: reducedMotion ? 0 : 200, padding: 0.2 }));   // once; importer only
}
```

- `fitView` after adding nodes is reliable since React Flow 12.5.0 (react-flow.md §17); the rAF defers until the new nodes are measured. This is the **only** place in F07–F14 that calls `fitView` outside the F06 initial mount and the F10 control (D-14d; contrast F07 FR-006).
- Fallback if `room.batch()` cannot wrap the hook handlers (per F07/F08 T-001): `const h = useHistory(); h.pause(); …same calls…; h.resume();` — one undo step; others may receive two messages (empty flash ≤ 1 frame). Record in status.md which path shipped.

### Templates (`lib/canvas/templates.ts`)

```ts
export interface CanvasTemplate { id: 'microservices' | 'cicd-pipeline' | 'event-driven'; name: string; description: string; document: CanvasDocument }

const COL = 280, ROW = 200;
function n(id: string, shape: NodeShape, label: string, color: NodeColorId, col: number, row: number): PersistedNode {
  const { width, height } = DEFAULT_SIZES[shape];
  return { id, type: 'canvasNode', position: { x: col * COL, y: row * ROW }, width, height, data: { label, shape, color } };
}
function e(id: string, source: string, sh: HandleId, target: string, th: HandleId, label?: string): PersistedEdge {
  return { id, source, target, sourceHandle: sh, targetHandle: th, type: 'canvasEdge', data: label ? { label } : {} };
}
```

Content (source ids are illustrative; `instantiateTemplate` replaces them):

| Template | Nodes (shape, colour, col,row) | Edges |
|---|---|---|
| microservices | Client (pill, neutral, 0,1) · API Gateway (hexagon, blue, 1,1) · Auth Service (rectangle, blue, 2,0) · Orders Service (rectangle, blue, 2,1) · Payments Service (rectangle, blue, 2,2) · Users DB (cylinder, teal, 3,0) · Orders DB (cylinder, teal, 3,1) · Payments DB (cylinder, teal, 3,2) · Cache (circle, orange, 1,2) | Client→Gateway "HTTPS"; Gateway→Auth, Orders, Payments; Auth→Users DB; Orders→Orders DB; Payments→Payments DB; Gateway→Cache "session" |
| cicd-pipeline | Developer (pill, neutral, 0,0) · Git Push (rectangle, neutral, 1,0) · Build (rectangle, blue, 2,0) · Tests pass? (diamond, orange, 3,0) · Container Registry (cylinder, teal, 4,0) · Deploy Staging (rectangle, green, 4,1) · Smoke test OK? (diamond, orange, 3,1) · Deploy Production (rectangle, green, 2,1) · Notify (circle, red, 1,1) | Dev→Push; Push→Build; Build→Tests?; Tests?→Registry "yes"; Tests?→Notify "no"; Registry→Staging; Staging→Smoke?; Smoke?→Production "yes"; Smoke?→Notify "no"; Notify→Dev |
| event-driven | Order Service (rectangle, blue, 0,0) · Inventory Service (rectangle, blue, 0,2) · Event Bus (hexagon, purple, 1,1) · Notification Consumer (rectangle, blue, 2,0) · Analytics Consumer (rectangle, blue, 2,1) · Fulfilment Consumer (rectangle, blue, 2,2) · Email Provider (pill, neutral, 3,0) · Analytics Store (cylinder, teal, 3,1) · Warehouse DB (cylinder, teal, 3,2) · Dead-letter Queue (circle, red, 1,2) | Order→Bus "order.created"; Inventory→Bus "stock.changed"; Bus→Notification, Analytics, Fulfilment; Notification→Email; Analytics→Analytics Store; Fulfilment→Warehouse DB; Bus→DLQ "failed"; DLQ→Bus "retry"; Fulfilment→Inventory "reserve" |

Handle choice rule: left-to-right edges use `right`→`left`; vertical edges `bottom`→`top`; return paths (Notify→Dev, DLQ→Bus) use `top`→`bottom`/`left`→`right` so arrows do not overlap.

`instantiateTemplate(t)`: builds `idMap` (old → `newNodeId(shape)`), copies nodes with new ids and fresh `data`/`position` objects, copies edges with `newEdgeId()` and remapped `source`/`target`.

### Preview (`template-preview.tsx`)

Pure function of `document`: compute `bounds = union(nodeRect)` + 24 px padding → `viewBox`. For each edge draw `<line>` centre-to-centre (stroke `var(--text-faint)`, 1.5). For each node: rectangle → `<rect rx=8>`; pill → `<rect rx=height/2>`; circle → `<circle>`; diamond/hexagon → `<polygon>` (same point sets as F07's `ShapeRenderer`); cylinder → `<rect rx=6>` + top `<ellipse>`. Fill/stroke from `NODE_COLORS`. Edges first, nodes on top. `role="img"`, `aria-label="Preview of <name>"`. Rendered at 240 × 140, `preserveAspectRatio="xMidYMid meet"`.

## Domain model and TypeScript contracts

Canvas schema v1 unchanged. `RoomEvent` is used exactly as `context/domain-model.md` declares it and F05 types it (no extension by F14):

```ts
// types/liveblocks.config.ts (F05) — member used here
{ type: 'CANVAS_REPLACED'; byUserId: string; templateName?: string }   // KICK and ROLE_CHANGED are the other members (F05/F12)
```

```ts
// lib/canvas/templates.ts
export const CANVAS_TEMPLATES: readonly CanvasTemplate[];
export function instantiateTemplate(t: CanvasTemplate): { nodes: CanvasNode[]; edges: CanvasEdge[] };
// lib/canvas/layout-check.ts
export function findOverlaps(nodes: readonly PersistedNode[], margin = 20): Array<[string, string]>;
// hooks/useImportTemplate.ts
export function useImportTemplate(): { importTemplate(t: CanvasTemplate): void; canImport: boolean; isEmptyCanvas(): boolean };
```

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Template definitions | Source code (`lib/canvas/templates.ts`) | Per data-ownership table; versioned with the app; validated in tests. |
| Imported nodes/edges | Liveblocks Storage via F06 hook | Written only through `useCanvasMutations` in one batch. |
| `CANVAS_REPLACED` event | Liveblocks broadcast (ephemeral) | Not persisted; late joiners get the canvas, not the toast. |
| Importer's viewport | React Flow (per user) | Fitted once; others untouched. |
| Dialog/confirmation open state | Component state | Ephemeral. |
| Fixtures | Repo (`tests/fixtures/...`) | Derived from source; a test keeps them equal. |

## API and integration contracts

- No routes or Server Actions. Liveblocks room event: `CANVAS_REPLACED` broadcast by the importer's client via `useBroadcastEvent()`; received via `useEventListener(({ event, user }) => …)`; `user` (the sender's `User` with `info.name`) is used for the toast name — the `byUserId` field remains for M2 server-side agents that cannot be room users.
- Authorization: Liveblocks write permission (`*:write`) from F05's auth route is the enforcement; broadcast by a read-only client is also rejected by Liveblocks (broadcast requires write access — UNVERIFIED on fetched pages; harmless either way because the toast is informational).

## Security and validation

- Threat: viewer imports via devtools → room rejects writes; UI hidden; hook no-op (three layers).
- Threat: malicious template content → templates are code-reviewed source, validated by schema in CI; no runtime user input.
- Threat: forged `CANVAS_REPLACED` events spamming toasts → bounded by Liveblocks event rate and the 10-connection room cap; toast dedupes identical messages within 2 s (sonner `id`).
- Size: largest template ≈ 6 kB JSON — far under limits.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `room.batch()` groups Storage+Presence changes into one message and one undo step (sync callback) | https://liveblocks.io/docs/api-reference/liveblocks-client | checked 2026-10-22 |
| `history.pause()/resume()` collapse changes into one undo step; undo per client | https://liveblocks.io/docs/api-reference/liveblocks-react , https://liveblocks.io/docs/products/sync/storage | checked 2026-10-22 |
| `@liveblocks/react-flow` `onDelete` removes node + edges atomically (one undo step); `addNode` replaces an item with the same id | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | checked 2026-10-22 |
| Offline mutations queue and send on reconnect | https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync | checked 2026-10-22 |
| Viewers hold `['*:read']` tokens; writes rejected | https://liveblocks.io/docs/api-reference/authentication/access-token | checked 2026-10-22 |
| `fitView({ padding, duration })` instance method; 12.5.0 fixed `fitView` right after adding nodes | https://reactflow.dev/api-reference/types/react-flow-instance , https://reactflow.dev/whats-new | checked 2026-10-22 |
| Persisted nodes need `width`/`height`; persisted edges need handles when nodes have several | https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration , https://reactflow.dev/api-reference/types/edge | checked 2026-10-22 |
| `useBroadcastEvent`/`useEventListener` exist in `@liveblocks/react` (KICK pattern uses them) | https://liveblocks.io/docs/use-cases/share-dialog , https://liveblocks.io/docs/api-reference/liveblocks-react | checked 2026-10-22 |
| **UNVERIFIED**: `room.batch()` wrapping the hook's handlers (shared assumption with F07/F08; fallback `history.pause/resume`). | — | — |
| **UNVERIFIED**: whether `broadcastEvent` from a read-only client is rejected. Not relied upon. | — | — |
| **UNVERIFIED**: `useEventListener` callback receives `{ event, user, connectionId }` with `user.info` — confirm in T-005; fallback resolve name via `useOthers` by `connectionId`. | https://liveblocks.io/docs/api-reference/liveblocks-react | checked 2026-10-22 (signature not captured in notes) |
