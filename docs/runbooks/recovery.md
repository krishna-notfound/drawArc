# Backup and recovery runbook

drawArc keeps each kind of data in exactly one authoritative store (`context/data-ownership.md`). This runbook
covers losing one of them (F15 FR-012, NFR-005). Rehearse every scenario once on a preview project and record
the log (template at the end) in `features/15-observability-and-deployment/status.md`.

| Data | Authoritative store | Backup |
|---|---|---|
| Users, projects, memberships, snapshot pointers | Neon Postgres | Neon branching / point-in-time restore |
| Live canvas | Liveblocks room Storage (room id = project id) | Blob snapshot `canvas/<projectId>.json`; Liveblocks version history (24 h Free, 30 d Pro) |
| Canvas snapshot | Vercel Blob (private store) | the live room re-writes it on the next autosave |

Before any risky operation on a room, copy it: `node scripts/export-room.mjs <projectId>` writes
`exports/<projectId>-<time>.json` (git-ignored, plain LSON). It uses `LIVEBLOCKS_SECRET_KEY` from
`.env.local` (development); pass the production key in the shell only during a production incident.

## 1. Liveblocks room lost, Blob snapshot intact (EC-013)

Detection: the workspace opens empty for a project whose `canvasSavedAt` is set.

1. Confirm the room really is empty (dashboard room list, or `export-room` shows no nodes).
2. Open the project as any member. The workspace gate seeds an empty room from the Blob snapshot on the server
   before rendering (F13 `seedRoomIfEmpty`, D-034).
3. If a seed-warning banner appears, Liveblocks or Blob was unreachable: reopen later; nothing was overwritten.
4. Verify the node and edge counts match the snapshot (`GET /api/projects/<id>/canvas`).

Rehearsal: note counts, delete the room's Storage (`deleteStorageDocument` from a node script against the
development project, or the dashboard), reopen, compare counts.

## 2. Blob snapshot lost, room intact (EC-014)

Detection: `GET /api/projects/<id>/canvas` answers `document: null` while `canvasSavedAt` is set.

1. Open the project as an owner or editor and make a trivial edit (move a node and back).
2. Wait for the autosave (30 s debounce, 60 s at most), press Save, or hide the tab (flushes on
   `visibilitychange`).
3. Verify `GET …/canvas` returns the document and `Project.canvasSavedAt` moved forward.

Audit which snapshots exist: `list({ prefix: 'canvas/' })` from `@vercel/blob` (up to 1000 per page, follow
`cursor` while `hasMore`), with the store token from `.env.local`.

## 3. Room and snapshot both lost (EC-015): residual risk

Postgres still has the project row, but the canvas is gone from both stores. The only remaining copy is
Liveblocks version history (24 h on Free, 30 days on Pro), restored from the Liveblocks dashboard, or a manual
`export-room` file if one was taken. Otherwise this is data loss; it is the documented residual risk of M1.

## 4. Postgres rows or schema lost

Detection: Prisma errors, missing projects or memberships.

1. In the Neon console (project `lucky-mud-20214365`), create a branch from the affected branch at a time before
   the incident (point-in-time branch; Neon's "branch restore" guide).
2. Verify the rows on the new branch (`psql` or the SQL editor, read-only queries).
3. Either restore the branch in place from the Neon console, or point the affected environment's
   `DATABASE_URL` / `DATABASE_URL_UNPOOLED` at the restored branch and redeploy.
4. Snapshots and rooms are keyed by project id, so restored rows find their canvas again.

Every step here changes Neon or Vercel: owner authorization required, including for the rehearsal (delete a
throwaway project row on a preview branch, branch from before the deletion, confirm the row is present).

## Rehearsal log template

| Scenario | Date / time (UTC) | Project | Nodes / edges before | After | Result | Notes |
|---|---|---|---|---|---|---|
| 1 room lost | | | | | | |
| 2 snapshot lost | | | | | | |
| 3 both lost | — | — | — | — | residual risk acknowledged | |
| 4 Postgres restore | | | row present before delete | row present on restored branch | | |
