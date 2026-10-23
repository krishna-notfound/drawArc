# F02 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (Gate 3).
- 2026-10-22 — Gate 4 audit fixes applied: webhook DB-failure status 502 `UPSTREAM` (code map), six two-layer ACs split (AC-002b, AC-007b, AC-011b, AC-024b, AC-026b; AC-029 now L2 only), migration ownership statement. See `features/AUDIT-2026-10-22.md`.

## Evidence
- None yet. Expected at Gate 7: `npm run check`, `npm run build` (no `blocking-prerender-*`), L2 run against `DATABASE_URL_TEST`, `npm run e2e` auth spec, AUTHZ-MATRIX results, migration 1 SQL reviewed and applied with the authorizing message quoted.

## Open issues
- D-F02-1 schema split (F02: Prisma setup + `User` + migration 1; F03: `Project`/`ProjectMember` + migration 2; F17 migration 3; F18 migration 4) — confirmed consistent across packages at Gate 4; owner to approve. Each migration requires its own authorization.
- D-F02-7: `app/page.tsx` (owner's "ghost ai" placeholder) is replaced by the redirect page — the only owner edit F02 overwrites.
- D-F02-2/D-F02-3/D-F02-4/D-F02-5/D-F02-6/D-F02-8 await owner confirmation (see `00-overview.md`).
- Cross-feature obligation: security-model says a deleted user's memberships are removed; `ProjectMember` does not exist in F02, so the webhook only sets `deletedAt`. F03/F12 must add the removal (tracked here until picked up).
- UNVERIFIED (resolved at T-002/T-007/T-008): Clerk 7.9 dark-theme package and appearance variable names; `ClerkProvider` prerender behaviour; Prisma `upsert` atomicity; `svix` signer compatibility for L2.
- Prerequisites not performed by this feature: Neon project/branches, Clerk dev instance + webhook + test users, GitHub repository secrets for L2/L3 in CI (F15 schedules CI E2E).
