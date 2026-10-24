# F12 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #9 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 3, own worktree |
| Last verified | 2026-10-24, `8a84d8f`; combined round-3 check at `d038dba` |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-030 (ROLE_CHANGED on every role change, KICK on removal), D-031 (KICK/ROLE_CHANGED → `client.logout()` + full reload), D-032 (reconnect re-verification via `checkMyAccess`), D-033 (removal allowed on archived projects; invite/role change not).
- 2026-10-22 — Gate 4 audit fixes applied (ROLE_CHANGED per domain-model, single listener shared with F05, helper wrappers, FR links). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `efb0849` member Server Actions, invite rules, rate limit, KICK/ROLE_CHANGED broadcasts · `6a79125` useKickListener + checkMyAccess on reconnect · `510b5bc` Share dialog in the navbar · `e9ad800` two-user e2e · `8a84d8f` dialog test timing.

| Check | Result |
|---|---|
| Agent gate | check 357/357, build OK, e2e 38/38, audit 0 |
| Round-3 combined (main session) | check 404/404, build OK, e2e 38/39 (downgrade test flakes under full-suite load; sharing spec 7/7 alone, twice) |
| Timings (real Clerk users A and B) | removal to AccessDenied 3.2–4.5 s (meets 5 s); downgrade to read-only 4.6–6.1 s on the dev server (test asserts outcome within 15 s and logs time) |

AC mapping (agent): L2 010, 012–021, 028; unit 002–005, 007–009, 022, 026, 029; e2e 001, 023, 024 (outcome), 025, 026, 027 (B already registered), 030; inspection 006, 007 (spinner), 011.

Rulings: invitee-without-account path not e2e-tested (would disturb the shared dev DB); non-owners never receive bound members' emails; duplicate/self errors shown under the email field; reconnect tests live in F05's kick-listener test file.

## Open issues
- Cross-feature prerequisites are now reflected in the owning specs (Gate 4): F02 binds pending `ProjectMember` rows by email in both the lazy upsert and the `user.created` webhook (F02 FR-010/FR-012); F05 provides `useUnloadGuard().suppress()`, hosts the kick listener with the `onReconnected` hook point, exposes `data-role`/`data-can-write`/`data-connection-status`, and returns 403 `{ error: 'forbidden' }` from the auth route. Role changes now broadcast `ROLE_CHANGED` (D-030 reworded); removals broadcast `KICK`.
- **Token TTL UNVERIFIED** — KICK + reconnect re-verification is the mitigation; if Liveblocks publishes a TTL, D-032 can be reconsidered.
- **`checkMyAccess` is a read-only Server Action** (Next discourages reads via actions in general); chosen because it runs once per reconnect and must be POST-only with session auth. Alternative: a route handler `GET /api/projects/[projectId]/access` — rejected under F03/D-024.
- **Rate limit counts surviving rows** (EC-004); an `(invitedById, invitedAt)` index or an `InviteLog` table would be a separate migration if needed.
- **Member removal UX** uses an inline two-step confirm rather than a modal; owner to confirm against ui-context "destructive confirmations use the destructive button variant and no input" (satisfied, but not a dialog).
- TC-024's "B cannot edit" sub-assertion and TC-023's "unsynced edits" precondition are `test.fixme` until F06 exists; the M1 acceptance run (F15) re-executes them fully.
- AC-024 "B cannot drag" and AC-023 "unsynced edits" are now testable with F06 merged — add in F07/F10 when node interaction exists.
- Downgrade latency 4.6–6.1 s on the dev server vs the 5 s target (PRD-013) — re-measure on a production deployment (F15).
- Owner's member list may show Pending for a few minutes after the invitee signs up (cache cannot be refreshed during render; accepted).
- Clerk dev test user B drawarc-e2e-b+clerk_test@example.com created 2026-10-24 (owner-approved, D-045).
