# F13 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #12 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — after round 4, own worktree |
| Last verified | 2026-10-24, `77b8468` on `feat/f13-persistence-and-recovery` |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/data-ownership.md`, D-009/D-022, `research/services.md` §D and `research/liveblocks.md` §6–§8 (checked 2026-10-22), and the reference prompt `21-canvas-autosave.md` / bug `current-issues-workspace-implementation.md` §1.
- 2026-10-22 — Gate 4 audit: seeding redesigned server-side per D-034 (FR-010 rewritten; FR-011/FR-012, AC-023/AC-024, TC-020/TC-021 withdrawn; FR-016, AC-029–AC-031, TC-024–TC-026 added; `hooks/useCanvasSeed.ts` and the viewer notice removed; `lib/liveblocks-flow.ts` + seed-warning banner added). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `959f1fc` private Blob store client + token activation · `b071993` canvas snapshot PUT/GET route · `0168749` server-side seeding in the workspace gate (D-034) · `4893f5b` debounced autosave + navbar Save status · `f5239e8` layer-local Liveblocks client for seeding + recovery e2e · `77b8468` npm override patching the zod nested in a Vercel package (audit).

| Check (main session, 2026-10-24) | Result |
|---|---|
| `npm run check` | 452/452 |
| `npm run build` | OK — `ƒ /api/projects/[projectId]/canvas` |
| `npm run e2e` | 46 passed (incl. recovery: add node → save → wipe room storage → reopen → restored from Blob) |
| `npm audit --audit-level=high` | 0 vulnerabilities |

Infrastructure: private Vercel Blob store `drawarc-blob` (`store_MqpS4uODwS26iU1T`, sin1) in team personal_project, linked to Vercel project `drawarc` (`prj_2yeE1KULtMOA94TCdkDUrSXZk9wQ`); GitHub auto-deploy disconnected (F15 decides deployment). `@vercel/blob` 2.8.2. No migration (pointer columns exist since F03). No test blobs left in the store.

AC mapping (agent): env test 001; authz matrix 004/010; validation, empty-doc guard, rate limit 005–007; autosave unit 013–018; seed tests + banner 020/021/029; recovery e2e 019/022; inspection/existing 002, 003, 008, 009, 011, 012, 025–027; not automated (lean) 028, 030, 031.

Rulings: Next gives route handlers and server components separate copies of the Liveblocks core, and a shared cached client from the wrong copy made the seed write plain JSON (canvas rendered but could not be edited) — client cache is now per copy (`lib/liveblocks.ts`); `canvasSavedAt` added to the access resolver's project; `save()` returns an outcome so the Save button can confirm before saving an empty canvas; manual Save always uploads.

## Open issues
- P-13-7 withdrawn at Gate 4 — superseded by D-034 (server-side seeding in the F04 gate via `getStorageDocument` + `mutateFlow`; no seed route; viewer-only rooms seed; the client double-seed race is gone). New PROPOSED P-13-8: Liveblocks REST failure at open renders the room unseeded with a warning banner and retries on the next open. Dependence on `mutateFlow` runtime semantics (R-05) is covered by F05 spike (a)/(f).
- P-13-2: rate limit as a 10 s minimum interval on `Project.canvasSavedAt` instead of a per-minute counter table (avoids a migration). Owner to confirm.
- P-13-1: empty-document guard with a confirm dialog on manual save and a 409 server-side; owner to confirm the UX.
- P-13-3: GET buffers rather than streams (migration needs the parsed document) — differs from the wording "streams JSON" in the planning brief.
- Depends on F03 having shipped `Project.canvasBlobPath/canvasSchemaVersion/canvasSavedAt`; otherwise a migration must be authorised before T-003.
- Depends on F05 spike (f) for `clearRoomStorage` on the dev server (TC-019).
- Error codes: per D-036 oversize/caps/schema failures are 422 `VALIDATION` and malformed envelopes 400 `VALIDATION`; invalid stored snapshots are 200 + `warning` on GET (and `warning: 'SNAPSHOT_INVALID'` on seed). No `PAYLOAD_TOO_LARGE` code is added (`INTERNAL` now exists in F00's union but is not needed here).
