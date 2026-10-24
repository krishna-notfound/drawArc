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

## Canvas schema v1 (PROPOSED → frozen at feature 06 approval)

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
