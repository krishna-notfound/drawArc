# drawArc — Domain Model

> Entities marked APPROVED follow owner decisions D-005 (user-owned projects, per-project sharing) and D-011 (local User table, email-keyed membership). Field-level detail is PROPOSED until feature `03` is approved. Canvas schema v1 is PROPOSED and becomes frozen when feature `06` is approved.

## Entity overview

```
User 1──* Project (ownerId)
User 0..1──* ProjectMember (userId, bound on first sign-in)
Project 1──* ProjectMember (projectId, email unique per project)
Project 1──0..1 CanvasSnapshot pointer (fields on Project)        ── Blob object canvas/{projectId}.json
Project 1──* TaskRun (M2)                                         ── Trigger.dev run
Project 1──* ProjectSpec (M3)                                     ── Blob object specs/{projectId}/{specId}.md
Project 1──1 Liveblocks room (roomId = projectId)                 ── Storage: { flow: { nodes, edges } }
[Future] Project 1──* ShareLink (feature 20)
```

## Entities

### User
Local projection of a Clerk user. Clerk is authoritative for identity; this row exists so membership, names, and avatars can be resolved without Backend API calls.

| Field | Type | Notes |
|---|---|---|
| id | cuid | internal id, used as Liveblocks `userId` |
| clerkId | string, unique | Clerk `user.id` |
| email | string, unique, lowercase | primary email at sync time |
| name | string? | `firstName lastName` or username |
| avatarUrl | string? | Clerk `imageUrl` |
| createdAt / updatedAt | datetime | |
| deletedAt | datetime? | set by `user.deleted` webhook; row retained for audit |

Invariants: `clerkId` never changes; `email` updates via webhook re-bind any `ProjectMember` rows by email.

### Project

| Field | Type | Notes |
|---|---|---|
| id | cuid | also the Liveblocks room id |
| ownerId | → User.id | owner has implicit role `owner`; **not** duplicated as a ProjectMember row |
| name | string (1–100) | default `Untitled Project` |
| description | string? (≤ 500) | |
| status | enum `ACTIVE` \| `ARCHIVED` | archived projects are read-only and hidden from lists by default |
| canvasBlobPath | string? | `canvas/{id}.json`; null until first save |
| canvasSchemaVersion | int? | version of the stored snapshot |
| canvasSavedAt | datetime? | last successful snapshot |
| createdAt / updatedAt | datetime | |

Indexes: `(ownerId, createdAt)`, `(status)`.

### ProjectMember

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| projectId | → Project.id, cascade delete | |
| email | string, lowercase | invitation target; unique with projectId |
| userId | → User.id? | bound when a User with this email exists (at invite time or on first sign-in) |
| role | enum `EDITOR` \| `VIEWER` | owner is never a member row |
| invitedById | → User.id | |
| invitedAt | datetime | |
| acceptedAt | datetime? | set when `userId` is bound |

Indexes: `(email)`, `(userId)`, `(projectId, role)`.

### Role (derived)

`ProjectRole = 'owner' | 'editor' | 'viewer'`. Resolution for `(user, project)`: owner if `project.ownerId === user.id`; else the member row matched by `userId` **or** by `email` (case-insensitive) — if matched by email only, bind `userId` and set `acceptedAt` in the same request. Null means no access.

Capabilities:

| Capability | owner | editor | viewer |
|---|---|---|---|
| open workspace, see presence/cursors | ✓ | ✓ | ✓ |
| mutate canvas (Liveblocks `*:write`) | ✓ | ✓ | — |
| autosave snapshot | ✓ | ✓ | — |
| start AI / spec runs (M2/M3) | ✓ | ✓ | — |
| download specs | ✓ | ✓ | ✓ |
| rename / archive / delete project | ✓ | — | — |
| invite / change role / remove members | ✓ | — | — |

### TaskRun (M2/M3)

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| runId | string?, unique | Trigger.dev run id; null between row insert and `tasks.trigger` returning (row is created first so the task can verify ownership) |
| kind | enum `DESIGN` \| `SPEC` | |
| projectId | → Project.id, cascade | |
| requestedById | → User.id | used to authorize public-token issuance |
| status | enum `QUEUED` \| `RUNNING` \| `SUCCEEDED` \| `FAILED` \| `CANCELED` | mirrored from Trigger.dev; Trigger.dev is authoritative |
| failureReason | string? | short, user-safe reason on FAILED |
| createdAt / updatedAt | datetime | |

### ProjectSpec (M3)

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| projectId | → Project.id, cascade | |
| taskRunId | → TaskRun.id? | |
| title | string | derived from project name + timestamp |
| blobPath | string | `specs/{projectId}/{id}.md` |
| sizeBytes | int | from the Blob put result |
| createdById | → User.id | |
| createdAt | datetime | |

### ShareLink (future, feature 20 — reserved, not created in M1)

`{ id, projectId, token (hashed), role: 'viewer', expiresAt?, revokedAt?, createdById }`. Reserved so `getProjectRole` has one extension point. Not in the M1 schema.

## Canvas schema v1 (frozen 2026-10-24 at F06 approval; superseded by v2 below — kept as history)

Defined in `types/canvas.ts` and validated in `lib/canvas/schema.ts`.

```ts
export const NODE_SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export const NODE_COLOR_IDS = ['neutral', 'blue', 'purple', 'orange', 'red', 'pink', 'green', 'teal'] as const;
export type NodeColorId = (typeof NODE_COLOR_IDS)[number];   // palette → hex pairs in ui-context.md

export interface CanvasNodeData { label: string; shape: NodeShape; color: NodeColorId }
export type CanvasNode = Node<CanvasNodeData, 'canvasNode'>;   // position, width, height required when persisted

export interface CanvasEdgeData { label?: string }
export type CanvasEdge = Edge<CanvasEdgeData, 'canvasEdge'>;   // sourceHandle/targetHandle ∈ 'top'|'right'|'bottom'|'left'

export interface CanvasDocument {
  schemaVersion: 1;
  nodes: PersistedNode[];   // CanvasNode minus runtime fields
  edges: PersistedEdge[];   // CanvasEdge minus runtime fields
}
```

Rules:
- Runtime-only fields are never persisted or synced by us: node `selected`, `dragging`, `measured`, `resizing`; edge `selected`.
- `width`/`height` are always set on persisted nodes (React Flow v12 treats them as fixed inline sizes; SSR needs them).
- Handle ids are the four side names; `sourceHandle`/`targetHandle` are required on persisted edges.
- Colour is stored as a palette **id**, not hex, so the palette can be retuned without migrating documents.
- Node and edge ids: `${shape}_${ulid}` / `e_${ulid}` — unique across clients and agent runs.
- Templates (feature 14) and agent output (feature 17) must validate against the same Zod schema.
- Any change to this shape bumps `schemaVersion` and adds a migration `migrateV{n}ToV{n+1}(doc)` in `lib/canvas/schema.ts`; loading always migrates to current before seeding the room.

## Canvas schema v2 (PROPOSED → frozen at F22 approval; D-057, 2026-10-28)

One migration, `migrateV1ToV2(doc)` = `{ ...doc, schemaVersion: 2 }`, reserves every field the batch-1–3 features need. Every new field is **optional with a per-kind default**, so v1 documents load unchanged and F21/F23/F24/F28 and the F08/F09 upgrades change behaviour only, never the version. Full contracts: `features/22-text-and-sticky-notes/02-design.md`.

```ts
export const CANVAS_SCHEMA_VERSION = 2 as const;
export const NODE_SHAPES = [...six geometric shapes] as const;                       // unchanged; F07 palette
export const NODE_KINDS  = [...NODE_SHAPES, 'text', 'sticky', 'line', 'freehand', 'frame', 'image'] as const;   // `data.shape` discriminator
export const HANDLE_KINDS = [...NODE_SHAPES, 'sticky', 'image'] as const;            // only these may be edge endpoints

export type NodeColor = NodeColorId | `#rrggbb`;                                    // D-063; text colour derived (pure #FFFFFF / #000000) for ≥ 4.58:1
export type TextOptions   = { size: 's'|'m'|'l'|'xl'; align: 'left'|'center'|'right'; valign: 'top'|'middle'|'bottom'; bold: boolean };
export type BorderOptions = { style: 'none'|'solid'|'dashed'|'dotted'; width: 1|2|3 };
export type MarkerKind    = 'none'|'arrow'|'arrowClosed'|'circle'|'diamond'|'bar';

type CommonData = { label: string; color: NodeColor; text?: TextOptions; border?: BorderOptions;
                    locked?: boolean; groupId?: `g_${ULID}`; order?: string /* fractional index, D-056; absent sorts lowest */; href?: `http(s)://…` };
export type CanvasNodeData =
  | CommonData & { shape: NodeShape }
  | CommonData & { shape: 'text'; autoWidth: boolean }                                                   // F22
  | CommonData & { shape: 'sticky' }                                                                     // F22
  | CommonData & { shape: 'line'; points: [x, y][] /* 2–100 */; stroke?: StrokeStyle }                   // F28
  | CommonData & { shape: 'freehand'; points: [x, y, pressure][] /* ≤ 2000 */; strokeWidth: number /* 2–16 */ }   // F21
  | CommonData & { shape: 'frame'; clip: boolean }                                                       // F23 (label = title)
  | CommonData & { shape: 'image'; image: { fileId: string; status: 'pending'|'saved'|'error'; natural: { width; height } } };   // F24

export type EdgeStyle = { path: 'smoothstep'|'step'|'straight'|'bezier'; dash: 'solid'|'dashed'|'dotted'; width: 1|2|3; markerStart: MarkerKind; markerEnd: MarkerKind };
export type CanvasEdgeData = { label?: string; style?: EdgeStyle };                  // absent = today's F09 rendering

export interface PersistedNode { id: `${NodeKind}_${ULID}`; type: 'canvasNode'; position; width; height; data: CanvasNodeData;
                                 parentId?: string /* must be a frame; one level */; extent?: 'parent' }
export interface CanvasDocument { schemaVersion: 2; nodes: PersistedNode[]; edges: PersistedEdge[] }
```

Rules added in v2 (v1 rules still apply):
- `data.shape` stays the discriminator and is never repurposed; kinds without UI in the current app render a placeholder, never crash.
- Minimum sizes are per kind (`MIN_SIZES`): shapes 48 × 32, text 24 × 20, sticky 75 × 75.
- An edge endpoint must be a `HANDLE_KINDS` node; a `parentId` must reference a `frame`; frames are never nested.
- Hex colours are `#rrggbb` only (either case accepted by the schema; writers normalise to lower-case). `lib/canvas/color.ts` — one module shared by F22 and F08 v2 — derives the text colour for a hex fill as pure `#FFFFFF` or `#000000` by WCAG relative luminance, which is always ≥ 4.58:1 (F08 D-08g; validation ruling 2026-10-28), so filled kinds need no refusal path; `textContrastOk(kind, hex)` guards only the `text` kind, whose hex is the text colour on `--bg-base`.
- Templates, agent output (`NODE_SHAPES` only) and import envelopes validate against the v2 schema; stored v1 snapshots are migrated on read and re-saved as v2 by the next autosave.
- A v2 document with `schemaVersion: 3` is still rejected ("newer version required").

## Liveblocks room shape

```ts
declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null; thinking: boolean };
    Storage: { flow: LiveObject<{ nodes: LiveMap<...>; edges: LiveMap<...> }> };   // managed by @liveblocks/react-flow; do not hand-edit
    UserMeta: { id: string; info: { name: string; avatar?: string; color: string }   // avatar omitted (Liveblocks rejects null) };
    RoomEvent:
      | { type: 'KICK'; userId: string }
      | { type: 'ROLE_CHANGED'; userId: string; role: 'editor' | 'viewer' }
      | { type: 'CANVAS_REPLACED'; byUserId: string; templateName?: string };
  }
}
```

## Invariants (enforced in code and tests)

1. A project has exactly one owner; the owner is never a `ProjectMember`.
2. `(projectId, email)` is unique; an email is normalised to lowercase before any comparison.
3. A user's role in a project is computed by `getProjectRole` only — no component or route infers it another way.
4. Liveblocks permissions are derived from `getProjectRole` at token time; the app never calls `updateRoom` with `usersAccesses`.
5. A snapshot is written only by a request authenticated as owner/editor and only after Zod validation.
6. Room seeding from a snapshot happens only when the room has no nodes and no edges, and is performed server-side (D-034).
7. Deleting a project deletes members, task runs, spec rows, blob objects, and the Liveblocks room (best effort for external systems, logged on failure).
8. `schemaVersion` on a stored document always equals the version it was validated against.

See [glossary.md](glossary.md) for term definitions and [data-ownership.md](data-ownership.md) for which system owns each field.
