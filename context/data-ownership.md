# drawArc — Data Ownership

> Principle 3: every data category has exactly one authoritative source. Store choices are APPROVED (D-005, D-009, D-011); mechanics are PROPOSED (D-012, D-034).

"Authoritative" means: when two copies disagree, this one is right, and every other copy is a derived projection that may be rebuilt from it.

| Data category | Authoritative source | Derived copies | Write path | Read path | Durability / recovery |
|---|---|---|---|---|---|
| Identity (who the user is, credentials, sessions) | **Clerk** | `User` row in Postgres (name, email, avatar) | Clerk UI; webhooks + lazy upsert update the row | `auth()` for the session; `User` row for display | Clerk-managed; row rebuilt from `currentUser()` on next request if missing |
| Project metadata (name, description, status, owner, timestamps) | **Postgres** | none | Server Actions / route handlers after role check | Prisma | Neon backups; Neon preview branches per PR |
| Membership and roles | **Postgres** (`ProjectMember`, `Project.ownerId`) | Liveblocks access token (short-lived claim) | Owner-only Server Actions | `getProjectRole` | Token is re-derived on every room join |
| Live canvas (nodes, edges while a room is open) | **Liveblocks Storage** (`flow`) | Blob snapshot; each client's React Flow state | `useLiveblocksFlow` handlers (client); `mutateFlow` (server: M1 seed in the workspace gate per D-034, M2 agent) | Liveblocks WS; `getStorageDocument` (server: M1 gate emptiness check, M2/M3 jobs) | Liveblocks persists rooms durably (10 MB/room); if lost, re-seed from snapshot |
| Canvas snapshot (durable copy) | **Vercel Blob** `canvas/{projectId}.json` (derived from Liveblocks, but authoritative *when the room is empty*) | `Project.canvasBlobPath/SavedAt/SchemaVersion` pointer | `PUT /api/projects/[id]/canvas` from client autosave (owner/editor) | Server only: the F04 gate reads it to seed an empty room (D-034); `GET …/canvas` for export/debug | Overwritten in place; Blob is not versioned by us — version history relies on Liveblocks (24 h Free / 30 d Pro) |
| Presence (cursors, thinking flag, who is online) | **Liveblocks Presence** | none | `updateMyPresence`; `setPresence` (server, M2) | `useOthers`, `useSelf` | Ephemeral by design; lost on disconnect |
| Undo/redo history | **Client memory** (Liveblocks history per connection) | none | automatic | `useUndo/useRedo` | Ephemeral; cleared on reload (documented) |
| Viewport (pan/zoom), selection, drag state | **Client memory** (React Flow) | none | React Flow | — | Ephemeral; never synced or persisted |
| Starter templates | **Source code** (`lib/canvas/templates.ts`) | none | code review | import | Versioned with the app; validated by the canvas schema in tests |
| AI room chat and status messages (M2) | **Liveblocks** (room-scoped feed or Storage list — decided in feature 16 after verifying the Feeds API) | none | client send; server append from the task | subscription | Retained per Liveblocks plan; not mirrored to Postgres in M2 |
| Background run state (M2/M3) | **Trigger.dev** (run status, attempts, metadata) | `TaskRun` row (ownership + mirrored status) | `tasks.trigger` + webhook/`onSuccess` hooks | `useRealtimeRun` with public token; `TaskRun` for authz | Trigger.dev retains per plan; `TaskRun` is the audit trail |
| Generated spec content (M3) | **Vercel Blob** `specs/{projectId}/{specId}.md` | `ProjectSpec` row (metadata) | task writes blob, then row | download route (server-proxied) | Blob durable; row rebuilt only manually |
| Secrets / configuration | **Vercel project env** (+ Trigger.dev env for tasks) | `.env.local` for dev | dashboard / `vercel env` | `lib/env.ts` (validated at boot) | Never in git |

## Rules that follow from the table

1. **Never duplicate canvas state in React state or Postgres.** The only copies are Liveblocks Storage (live) and the Blob snapshot (durable). Postgres holds the pointer, not the document.
2. **Snapshot writes are one-directional and gated.** Room → Blob, only from an owner/editor's client, only after server-side Zod validation, debounced ≥ 30 s, plus a flush on tab hide. The `storageUpdated` webhook (60 s throttle, not guaranteed) may trigger a server-side backstop save in a later feature; it is never the primary path.
3. **Snapshot reads are conditional and server-side (D-034).** The workspace gate seeds a room via `mutateFlow` only when `getStorageDocument` shows zero nodes and zero edges. A non-empty room always wins. Clients never seed (viewers hold read tokens; two clients seeding at once is a race).
4. **Roles are computed, never cached in the client as truth.** The client receives its role for UI affordances; the server recomputes it on every mutation and every token issuance.
5. **Identity fields are eventually consistent.** `User.name/avatarUrl` may lag Clerk by webhook latency; nothing security-relevant depends on them.
6. **Server-side room writes (M2) are not transactions.** The agent computes a complete, validated plan, then applies it in one synchronous `mutateFlow` pass after `createVersionHistorySnapshot`.
7. **Deleting a project** cascades in Postgres and then best-effort deletes the Blob objects and the Liveblocks room, logging failures; a periodic cleanup task is a future feature, not M1.
8. **Blob URLs are internal.** Clients receive content through our routes; a blob URL or pathname never appears in a client response.

## Schema evolution

- Postgres: Prisma migrations, reviewed in PRs, applied with `prisma migrate deploy` against the unpooled URL in CI/Vercel build.
- Canvas document: `schemaVersion` + forward migrations (see [domain-model.md](domain-model.md)). Liveblocks Storage itself is migrated lazily: a room is only ever seeded with a current-version document, and in-room data shape changes require a `massMutateStorage` migration task approved separately.
- Liveblocks `Presence`/`UserMeta` changes are backward compatible by making new fields optional.
