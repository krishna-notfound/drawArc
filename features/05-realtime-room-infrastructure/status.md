# F05 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #7 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — implementation agent in its own git worktree, in parallel |
| Last verified | 2026-10-24, `a41af14`; combined round-2 check at `0dff1a6` |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*` and `research/liveblocks.md` / `research/nextjs-testing.md` (checked 2026-10-22).
- 2026-10-22 — Gate 4 audit fixes applied (KICK/ROLE_CHANGED → logout + reload, `checkMyAccess` hook point, `templateName` on `CANVAS_REPLACED`, helper boolean results, root Playwright config on port 3000, `@xyflow/react` owned by F01). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `17bf91c` Liveblocks 3.24.4 pinned, room types, server client · `a5de71a` liveblocks-auth, resolve-users, webhook routes · `9702ce5` room providers, connection pill, revocation listener · `a41af14` two-user room harness, smoke test, spike.

| Check | Result |
|---|---|
| Agent gate | check 320/320, build OK, e2e 26 passed / 1 skipped, audit 0 |
| Round-2 combined (main session) | check 327/327, build OK (`ƒ /api/liveblocks-auth`, `ƒ /api/users/resolve`, `ƒ /api/webhooks/liveblocks`), e2e 33 passed / 1 skipped |

Spike (R-05): `mutateStorage` writes are readable inside the callback and persisted on resolve; `updateNode` merges top level only (`updateNodeData` merges into `data`); viewport is not synced; `onNodesChange` `add` writes to Storage. Liveblocks dev server needs Bun and fails on Windows (CLI path bug) — verified against the cloud Development project instead.

AC mapping (agent): unit 003/004; L2 005/006/007/009; webhook signature 018/019; KickListener unit 016/017/017b; room smoke e2e 010/021; env 020; existing tests 001/023; inspection 002/008/011/012/014. Deferred: 013, 015, kick/role e2e for 016/017 (needs Clerk user B); 022 owner review.

Rulings: avatar omitted (not null) in userInfo; Storage `flow` optional; archived projects → read-only tokens for everyone; single `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL`; signed unknown webhook types → 200; `onReconnected` as a prop; e2e targets the cloud Development project (both sessions are user A).

## Open issues
- P-05-2 (`ROLE_CHANGED`) is already reflected in `context/domain-model.md` and `security-model.md` (Gate 4); only the decision-log copy remains for Gate 5. The client reaction for KICK and ROLE_CHANGED is `client.logout()` + full reload (D-031); the earlier "navigate to `/editor` + toast" design was withdrawn at Gate 4.
- P-05-6 places hex `USER_COLORS` in `types/liveblocks.config.ts`, an exception to `context/code-standards.md` "Styling" (hex only in `types/canvas.ts` / `globals.css`); owner to confirm or move the constant to F06.
- Dev-server authentication mode for our access-token route is UNVERIFIED until T-001 (e); the `pk_localdev` fallback weakens L3 authz coverage to L2.
- Whether a 401 status with the forbidden body stops client retries is UNVERIFIED (T-001); fallback is 403 for the unauthenticated case.
- The `Storage` generic in `types/liveblocks.config.ts` is a best-effort description of the react-flow package's internal LSON; finalised from the T-001 dump.
- `ProjectRoom` not yet mounted in the workspace — F06 mounts it.
- Clerk test user B (dev instance) would make the two-user tests real — needs owner OK.
- `LIVEBLOCKS_WEBHOOK_SECRET_KEY` is a local placeholder; register the Liveblocks webhook after deployment (F15).
- Liveblocks 3.24.5 is available; bump is a one-line change (keep all @liveblocks/* equal).
