# F15 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session.
- 2026-10-22 — Gate 4 audit fixes applied (template headings added to 02-design, `lib/http.ts` folded into F00's `lib/errors.ts`, server-side seed wording in the recovery runbook, env inventory rows). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) Expected artefacts: Vercel/Neon/Clerk/Liveblocks/Blob dashboard screenshots (AC-001–AC-006), log line for AC-011, `docs/perf/<commit>.md`, Playwright reports from `e2e-on-preview`, CSP report summary (AC-020), recovery rehearsal log (AC-023), tag and deployment id (AC-026).

## M1 acceptance run evidence
Commit: — · Date: — · Environment URL: — · Executed by: —

| Step | Actor(s) | Action | Expected | Evidence | Pass/Fail |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 7 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 8 | | | | | |

Owner sign-off: —

## Open issues
- D-019 (error-reporting SaaS) is OPEN; Option A is the baseline in this spec, Option B is T-013 (conditional).
- O-2 (Liveblocks plan; Free is non-commercial) must be answered before the first production deployment (T-007).
- UNVERIFIED items to resolve during T-009/T-010/T-014: Vercel request-id header name; Clerk script/connect and Liveblocks CSP hosts; Neon point-in-time restore procedure page; Liveblocks dashboard Storage export; `@axe-core/playwright` version.
- Preview webhooks: PROPOSED single preview alias for Clerk/Liveblocks webhooks (02-design.md); feature-branch previews rely on lazy `User` upsert only.
