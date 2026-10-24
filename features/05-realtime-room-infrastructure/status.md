# F05 — Status

| Field | Value |
|---|---|
| Status | Approved (2026-10-24); implementation in progress (parallel round 2 with F04) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — implementation agent in its own git worktree, in parallel |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*` and `research/liveblocks.md` / `research/nextjs-testing.md` (checked 2026-10-22).
- 2026-10-22 — Gate 4 audit fixes applied (KICK/ROLE_CHANGED → logout + reload, `checkMyAccess` hook point, `templateName` on `CANVAS_REPLACED`, helper boolean results, root Playwright config on port 3000, `@xyflow/react` owned by F01). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 spike output for FR-018 (a)–(f) goes here verbatim before F06 starts.

## Open issues
- P-05-2 (`ROLE_CHANGED`) is already reflected in `context/domain-model.md` and `security-model.md` (Gate 4); only the decision-log copy remains for Gate 5. The client reaction for KICK and ROLE_CHANGED is `client.logout()` + full reload (D-031); the earlier "navigate to `/editor` + toast" design was withdrawn at Gate 4.
- P-05-6 places hex `USER_COLORS` in `types/liveblocks.config.ts`, an exception to `context/code-standards.md` "Styling" (hex only in `types/canvas.ts` / `globals.css`); owner to confirm or move the constant to F06.
- Dev-server authentication mode for our access-token route is UNVERIFIED until T-001 (e); the `pk_localdev` fallback weakens L3 authz coverage to L2.
- Whether a 401 status with the forbidden body stops client retries is UNVERIFIED (T-001); fallback is 403 for the unauthenticated case.
- The `Storage` generic in `types/liveblocks.config.ts` is a best-effort description of the react-flow package's internal LSON; finalised from the T-001 dump.
