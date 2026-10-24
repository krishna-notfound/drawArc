# F13 — Status

| Field | Value |
|---|---|
| Status | Approved (2026-10-24); implementation follows round 4 |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/data-ownership.md`, D-009/D-022, `research/services.md` §D and `research/liveblocks.md` §6–§8 (checked 2026-10-22), and the reference prompt `21-canvas-autosave.md` / bug `current-issues-workspace-implementation.md` §1.
- 2026-10-22 — Gate 4 audit: seeding redesigned server-side per D-034 (FR-010 rewritten; FR-011/FR-012, AC-023/AC-024, TC-020/TC-021 withdrawn; FR-016, AC-029–AC-031, TC-024–TC-026 added; `hooks/useCanvasSeed.ts` and the viewer notice removed; `lib/liveblocks-flow.ts` + seed-warning banner added). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — private Blob store creation (store id, scopes) and the first OIDC write on a preview deployment are recorded here.

## Open issues
- P-13-7 withdrawn at Gate 4 — superseded by D-034 (server-side seeding in the F04 gate via `getStorageDocument` + `mutateFlow`; no seed route; viewer-only rooms seed; the client double-seed race is gone). New PROPOSED P-13-8: Liveblocks REST failure at open renders the room unseeded with a warning banner and retries on the next open. Dependence on `mutateFlow` runtime semantics (R-05) is covered by F05 spike (a)/(f).
- P-13-2: rate limit as a 10 s minimum interval on `Project.canvasSavedAt` instead of a per-minute counter table (avoids a migration). Owner to confirm.
- P-13-1: empty-document guard with a confirm dialog on manual save and a 409 server-side; owner to confirm the UX.
- P-13-3: GET buffers rather than streams (migration needs the parsed document) — differs from the wording "streams JSON" in the planning brief.
- Depends on F03 having shipped `Project.canvasBlobPath/canvasSchemaVersion/canvasSavedAt`; otherwise a migration must be authorised before T-003.
- Depends on F05 spike (f) for `clearRoomStorage` on the dev server (TC-019).
- Error codes: per D-036 oversize/caps/schema failures are 422 `VALIDATION` and malformed envelopes 400 `VALIDATION`; invalid stored snapshots are 200 + `warning` on GET (and `warning: 'SNAPSHOT_INVALID'` on seed). No `PAYLOAD_TOO_LARGE` code is added (`INTERNAL` now exists in F00's union but is not needed here).
