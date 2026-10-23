# F13 — Persistence and Recovery

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F06 (`CanvasDocumentSchema`, `migrate`, `toDocument`/`fromDocument`, `FlowCanvas` children slot), F05 (room, webhook route, `twoUsers` fixture, `clearRoomStorage` helper), F03 (`Project.canvasBlobPath/canvasSavedAt/canvasSchemaVersion`, `requireProjectRole`), F04 (navbar Save slot) |
| Depended on by | F14 (templates reuse the seed/replace path and schema), F15 (perf test seeds 500 nodes via `PUT …/canvas`), F17 (agent reads the same schema; version snapshot before writes), F19 (export reads `GET …/canvas`) |
| Product requirements | PRD-033, PRD-034, NFR-005 |
| Status | see status.md |

## Purpose

F13 gives the canvas a durable copy. Liveblocks Storage is the live truth while a room is open; this feature writes a `CanvasDocument` snapshot to the private Vercel Blob store (`canvas/{projectId}.json`) from an editor's client on a debounced schedule, records the pointer on `Project`, and — when the workspace gate finds the room empty on open — seeds it **server-side** from that snapshot (validated and migrated forward) through `mutateFlow` before the page renders (D-034). It sits after F06 because it serialises the frozen schema, and before F14/F17 because templates and the agent depend on the same load/validate path.

## Problem statement and goals

- Problem: Liveblocks persists rooms, but drawArc owns no copy; a deleted room, a plan change, or a corrupted document would lose the diagram, and there is no versioned, app-validated artefact for export (F19) or the agent (F17). PRD-033/034 require autosave with visible status and forward migration.
- G-1: While an editor is active, the snapshot is never more than one autosave interval (≤ 60 s) behind the room (NFR-005); closing the tab flushes.
- G-2: Reopening a project whose room is empty restores the identical diagram (M1 acceptance run step 5).
- G-3: Every write is server-validated against `CanvasDocumentSchema`, capped (4 MB, 2,000 nodes, 4,000 edges), role-gated (editor+), and rate-limited (≤ 6/min/project).
- G-4: An older `schemaVersion` loads by migration, never by crashing (PRD-034).
- G-5: A snapshot never overwrites live collaboration, and an empty room never silently overwrites a non-empty snapshot.

## Scope

In scope:
- `@vercel/blob` `^2.8.2`; `lib/blob.ts` (`canvasPathname`, `putCanvas`, `getCanvas`, `deleteCanvas`).
- `PUT /api/projects/[projectId]/canvas` and `GET /api/projects/[projectId]/canvas`.
- `hooks/useAutosave.ts` (debounce 30 s, max-wait 60 s, flush on hide/pagehide, status, manual save, empty-document guard), `components/canvas/canvas-persistence.tsx` (mounts autosave inside `FlowCanvas`), `components/editor/save-context.tsx`, `components/editor/save-button.tsx` (navbar).
- `lib/liveblocks-flow.ts`: `seedRoomIfEmpty(project)` — server-side seeding called from the F04 workspace gate (replacing F04's no-op stub in `lib/editor/seed-hook.ts`): `getStorageDocument` → if 0 nodes and 0 edges and `canvasBlobPath` set → `getCanvas` → `migrate` → `validateDocument` → one `mutateFlow({ client, roomId, storageKey: 'flow' })` pass; never throws (returns a `warning`). `components/canvas/seed-warning-banner.tsx` for the failure case.
- `Project` pointer fields (defined by F03 per domain-model; F13 only writes them), `deleteCanvas` wired into the F03 delete action.
- Migration fixtures per schema version; `storageUpdated` webhook backstop documented as deferred.
- E2E: reload identical; reopen after room storage cleared identical (for editors **and** viewer-only rooms).

Out of scope / non-goals:
- Version history UI (non-goal; Liveblocks version snapshots only). Multiple named snapshots in Blob (D-022). Server-driven autosave from `storageUpdated` (deferred — see P-13-6). Templates (F14). Export formats (F19). Conflict resolution between snapshot and room (the room always wins; never merged).

## User stories

- US-1: As an editor, I want the diagram saved automatically and to see "Saved 14:02" so that I never think about saving.
- US-2: As an editor, I want to press Save before a demo so that I know the snapshot is current.
- US-3: As an owner reopening a project after a long time, I want the same diagram back even if the room was cleared.
- US-4: As a viewer, I must not be able to save (server rejects), and when I open a project whose room is empty I still want to see the last saved diagram (the server seeds it; my read token is irrelevant to seeding).
- US-5 (abuse): As a non-member, I must not read or write any project's snapshot even with its id; as an editor, I must not be able to upload a 50 MB file or a document that fails the schema.
- US-6 (data loss): As an editor whose room came up empty because of a transient Liveblocks problem, I must not have my snapshot overwritten by an empty document without confirming.

## Key decisions referenced

- D-009 (Blob private store, pointer on Project, ≥ 30 s debounce, 4 MB cap), D-022 (`useCache: false`, deterministic pathname, no Blob versioning), D-012, **D-034 (snapshot seeding is server-side: workspace gate + `getStorageDocument` + `mutateFlow`, never client-side)**, D-036 (`VALIDATION` 400 for malformed input, 422 for semantic/limit violations), F06 P-06-6 (schema freeze), F04 FR-009 (the gate's seed hook point), R-04, R-05 (`mutateFlow` runtime semantics — F05 spike (a)/(f)), R-08.
- PROPOSED by this feature:
  - **P-13-1** Empty-document guard: autosave never uploads a document with 0 nodes and 0 edges while a snapshot exists; a manual Save of an empty canvas asks "Save an empty canvas? This replaces the last saved diagram." and sends `allowEmpty: true`; the server returns 409 for an empty document over an existing snapshot without that flag. Rationale: an empty room is far more often a loading/plan/outage artefact than an intentional clear (US-6).
  - **P-13-2** Rate limit implemented as a minimum interval: PUT is rejected with 429 + `Retry-After` when `Project.canvasSavedAt` is less than 10 s old (= 6/min/project without a new table or migration). Rationale: the limit's purpose is quota protection, not fairness; two editors saving the same room produce identical content, so the second save is redundant and the client just reschedules.
  - **P-13-3** GET buffers the blob (≤ 4 MB), parses, migrates, validates, then responds with JSON; it does not stream. Rationale: migration requires the parsed document; 4 MB is well within function memory.
  - **P-13-4** GET reads the blob by the deterministic pathname regardless of the pointer; `canvasBlobPath/SavedAt/SchemaVersion` are metadata for UI and seeding decisions. Rationale: makes the non-atomic put→pointer sequence (R-04) harmless for recovery — a failed pointer update only yields a stale "Saved" time.
  - **P-13-5** Unload flush uses `fetch(..., { keepalive: true })` only when the serialised body ≤ 60 KB (browser keepalive limit is 64 KB); larger documents rely on the `visibilitychange` flush (normal fetch) and the F05 `beforeunload` guard. Rationale: keepalive silently fails above the limit.
  - **P-13-6** `storageUpdated` backstop is deferred (PROPOSED-deferred): the webhook is throttled to 60 s and "may not be triggered for every write", so it cannot replace client autosave; it could trigger a server-side `getStorageDocument → validate → put` later for rooms with no active editor. Not built in M1.
  - **P-13-7 (withdrawn — D-034)** Client-driven seeding by owners/editors was withdrawn at Gate 4: viewers hold read tokens and could not seed, and two editors opening an empty room raced. Seeding is now server-side in the F04 gate (D-034); no seed route is added and no client ever writes a snapshot into a room.
  - **P-13-8** Server-side seed failures are non-fatal: if the Liveblocks REST read/write fails at open, the gate renders the room unseeded with the warning banner "The saved diagram couldn't be restored right now. It will be retried the next time this project is opened." and the next open retries (the room is still empty, the snapshot still exists). Rationale: a Liveblocks REST hiccup must not block access to the workspace; the retry is implicit because the condition (empty room + snapshot) persists.

## Reference material

- `context/data-ownership.md` rows "Live canvas", "Canvas snapshot", rules 1–3 (rule 3: reads are conditional and **server-side**, D-034), 8; `context/architecture-context.md` "Persistence architecture" (Load, D-034); `context/security-model.md` "Snapshot and artifact access", "Rate limiting"; `context/domain-model.md` invariants 5, 6 (seeding performed server-side), 8.
- Research `research/services.md` §D (Vercel Blob 2.8.2: private store, `get` with `useCache: false`, `put` options, 4.5 MB function body limit, advanced-op quotas 2k/month Hobby, 900/min) and `research/liveblocks.md` §6–§8 (`getStorageDocument`, `storageUpdated` throttle, offline queue, `history.disable`/`clear`) — checked 2026-10-22.
- Reference prompt `No_touch_ai/…/feature-specs/21-canvas-autosave.md` (intent: PUT/GET routes, debounced hook, status, load only into empty room). Its "store the blob URL" is superseded by pathname + private `get` (security-model: blob URLs never reach clients); reference bug `current-issues-workspace-implementation.md` §1 (`access: "public"`, raw fetch of the blob URL) becomes AC-003/AC-010 here.
