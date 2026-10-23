# F12 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-030 (ROLE_CHANGED on every role change, KICK on removal), D-031 (KICK/ROLE_CHANGED → `client.logout()` + full reload), D-032 (reconnect re-verification via `checkMyAccess`), D-033 (removal allowed on archived projects; invite/role change not).
- 2026-10-22 — Gate 4 audit fixes applied (ROLE_CHANGED per domain-model, single listener shared with F05, helper wrappers, FR links). See `features/AUDIT-2026-10-22.md`.

## Evidence
- none yet.

## Open issues
- Cross-feature prerequisites are now reflected in the owning specs (Gate 4): F02 binds pending `ProjectMember` rows by email in both the lazy upsert and the `user.created` webhook (F02 FR-010/FR-012); F05 provides `useUnloadGuard().suppress()`, hosts the kick listener with the `onReconnected` hook point, exposes `data-role`/`data-can-write`/`data-connection-status`, and returns 403 `{ error: 'forbidden' }` from the auth route. Role changes now broadcast `ROLE_CHANGED` (D-030 reworded); removals broadcast `KICK`.
- **Token TTL UNVERIFIED** — KICK + reconnect re-verification is the mitigation; if Liveblocks publishes a TTL, D-032 can be reconsidered.
- **`checkMyAccess` is a read-only Server Action** (Next discourages reads via actions in general); chosen because it runs once per reconnect and must be POST-only with session auth. Alternative: a route handler `GET /api/projects/[projectId]/access` — rejected under F03/D-024.
- **Rate limit counts surviving rows** (EC-004); an `(invitedById, invitedAt)` index or an `InviteLog` table would be a separate migration if needed.
- **Member removal UX** uses an inline two-step confirm rather than a modal; owner to confirm against ui-context "destructive confirmations use the destructive button variant and no input" (satisfied, but not a dialog).
- TC-024's "B cannot edit" sub-assertion and TC-023's "unsynced edits" precondition are `test.fixme` until F06 exists; the M1 acceptance run (F15) re-executes them fully.
