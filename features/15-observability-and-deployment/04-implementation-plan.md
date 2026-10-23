# F15 — Implementation Plan (outline)

## Dependencies, environment, migrations

- Dependencies to install (dev): `@axe-core/playwright` (caret; version UNVERIFIED — pin at install time and record in `status.md`). No runtime dependencies. Option B (Sentry) would add `@sentry/nextjs` — only under T-013 with its own authorization.
- Environment variables: none new for M1 code paths. Rows for `TRIGGER_SECRET_KEY`, `LLM_API_KEY`, and Trigger.dev-side variables are reserved in the inventory and added by F17.
- Migrations: **none**. AC-002 uses a no-op probe migration on a scratch branch that is never merged.
- External-service changes: every task marked **[EXT]** below changes a dashboard (Vercel, Neon, Clerk, Liveblocks, Blob store) and **requires separate authorization: external service change** per ai-workflow-rules.md. Code tasks and [EXT] tasks are authorized independently; an [EXT] task is done only when the human has performed or witnessed the dashboard change and its evidence is in `status.md`.

## Tasks

| Task | Deliverable | Satisfies | Files | Done when | Authorization note |
|---|---|---|---|---|---|
| T-001 | `lib/request-id.ts` (`newRequestId`, `withRequest`), `lib/logger.ts` `child()` and `LogFields`, F00's `lib/errors.ts` `errorResponse(err, { requestId })` + `ActionError.requestId` (no new error module, D-036). Unit tests. | FR-007 | `lib/request-id.ts`, `lib/logger.ts`, `lib/errors.ts`, `tests/unit/request-id.test.ts` | AC-009, AC-010 pass | code |
| T-002 | Adopt `withRequest` / `newRequestId` in every route handler and Server Action from F02–F14 (mechanical sweep; no behaviour change); grep gate: no `NextResponse.json({ error` outside `lib/errors.ts`. | FR-007 | `app/api/**/route.ts`, `app/**/actions.ts` | `npm run check` green; AC-011 evidence captured on the first preview | code |
| T-003 | Error boundaries: complete `app/error.tsx`, add `app/global-error.tsx`, `app/editor/[projectId]/error.tsx`, `app/editor/[projectId]/not-found.tsx`, root `app/not-found.tsx` (if F01 left it minimal); dev-only throw hooks for tests; E2E + axe. | FR-008 | `app/error.tsx`, `app/global-error.tsx`, `app/editor/[projectId]/error.tsx`, `app/editor/[projectId]/not-found.tsx`, `app/not-found.tsx`, `tests/e2e/error-boundaries.spec.ts` | AC-012, AC-013 pass | code |
| T-004 | Env inventory enforcement: `tests/unit/env/inventory.test.ts` (schema ↔ `.env.example` ↔ inventory table parsed from `features/15-…/02-design.md`), `tests/unit/env/env.test.ts`; complete `.env.example`. | FR-006 | `.env.example`, `lib/env.ts` (additions only if a key is missing), `tests/unit/env/*.test.ts` | AC-007, AC-008 pass | code |
| T-005 **[EXT]** | Create the Vercel project linked to the GitHub repo; set build command `prisma migrate deploy && next build`; install the Neon Vercel-managed integration (preview branches on); set Development/Preview/Production env vars from the inventory (Clerk Development keys on Dev+Preview, Production keys on Production). | FR-001, FR-002, FR-006 | Vercel dashboard; `vercel.json` only if the build command cannot be set in the dashboard (`{ "buildCommand": "prisma migrate deploy && next build" }`) | AC-001, AC-002, AC-003 evidence in `status.md` | **requires separate authorization: external service change** (Vercel + Neon) |
| T-006 **[EXT]** | Clerk: confirm Development instance for local/preview; create Production instance (domain, keys); create webhook endpoints (production URL; preview alias URL) with `user.created/updated/deleted`; store signing secrets per environment. | FR-003 | Clerk dashboard; Vercel env | AC-004 passes (L2 test with both secrets as test fixtures, real secrets never in repo) | **requires separate authorization: external service change** (Clerk) |
| T-007 **[EXT]** | Liveblocks: confirm project, development vs production secret keys; create webhook endpoints per environment (`storageUpdated`, `userLeft` as F05/F13 require); record O-2 answer (plan) in the decision log before production. | FR-004 | Liveblocks dashboard; Vercel env; `context/decision-log.md` O-2 line (owner writes it) | AC-005 evidence | **requires separate authorization: external service change** (Liveblocks; plan purchase is an owner decision) |
| T-008 **[EXT]** | Vercel Blob: create store with access **private**, connect to the project for all environments (OIDC); `vercel env pull` for local `BLOB_READ_WRITE_TOKEN`; add CI secret. | FR-005 | Vercel dashboard; GitHub Actions secrets | AC-006 evidence | **requires separate authorization: external service change** (Blob store creation is irreversible as to access mode) |
| T-009 | Security headers and CSP report-only in `next.config.ts`; `images.remotePatterns`; `/api/csp-report` route (public, log-only, body ≤ 8 KB); `tests/e2e/security-headers.spec.ts`. | FR-011 | `next.config.ts`, `app/api/csp-report/route.ts`, `tests/e2e/security-headers.spec.ts` | AC-019 passes locally and on preview | code |
| T-010 | CSP host verification: run the acceptance-run flows on the preview in a clean profile; collect `/api/csp-report` lines; verify each unknown host against Clerk/Liveblocks docs (URLs recorded with "checked <date>"); update the policy; record in `status.md`. Switching to enforcing is a later, separate task (F15-D2). | FR-011 | `next.config.ts`, `status.md` | AC-020 evidence | code (+ reads preview logs) |
| T-011 | `scripts/scan-bundle.ts` + `scripts/check-pins.ts` with unit tests; `package.json` scripts `scan:bundle`, `check:pins`; CI `build` job runs the scan after `next build`; `audit` job runs `npm audit --audit-level=high` and `check:pins`. | FR-011, FR-013 | `scripts/scan-bundle.ts`, `scripts/check-pins.ts`, `tests/unit/scripts/*.test.ts`, `.github/workflows/ci.yml`, `package.json` | AC-021, AC-022, AC-024 pass | code |
| T-012 | Performance: `scripts/gen-large-fixture.ts` → `tests/fixtures/canvas/large-500-nodes.json`; fixture unit test; `tests/e2e/perf.spec.ts` with Playwright project `preview` (`baseURL` from `E2E_BASE_URL`); `npm run e2e:preview`. Run on a preview; record numbers; perform the manual Chrome profile; write `docs/perf/<commit>.md`. | FR-010 | `scripts/gen-large-fixture.ts`, `tests/fixtures/canvas/large-500-nodes.json`, `tests/unit/fixtures/large-fixture.test.ts`, `tests/e2e/perf.spec.ts`, `playwright.config.ts`, `docs/perf/<commit>.md` | AC-015–AC-018 pass/recorded | code (manual profile is part of the task's evidence) |
| T-013 (conditional) | **Only if the owner chooses D-019 Option B:** add `@sentry/nextjs`, `instrumentation.ts`, client/server configs, `withSentryConfig`, `beforeSend` scrubbing + unit test, tunnel route, CSP rows, env rows (`NEXT_PUBLIC_SENTRY_DSN`, CI `SENTRY_AUTH_TOKEN`). | FR-009 | `instrumentation.ts`, `sentry.*.config.ts`, `next.config.ts`, `app/global-error.tsx`, `tests/unit/sentry-scrub.test.ts` | AC-014 records B and the Sentry project receives a test event from the preview | **requires separate authorization** (new dependency + external service: Sentry project, DSN) |
| T-014 | Runbooks: `docs/runbooks/recovery.md`, `docs/runbooks/dependencies.md`, `docs/runbooks/release.md`; `scripts/export-room.ts`. Rehearse recovery scenarios on a preview project; record the rehearsal log. | FR-012, FR-013, FR-014 | `docs/runbooks/*.md`, `scripts/export-room.ts`, `status.md` | AC-023, AC-024 (doc part), AC-026 (doc part) | code; the Postgres branch-restore rehearsal creates a Neon branch → **requires separate authorization: external service change** (Neon) |
| T-015 | CI: extend F00's `.github/workflows/ci.yml` with `e2e-on-preview` (waits for the Vercel deployment status check, exports `E2E_BASE_URL`, runs `npm run e2e -- --project=preview`, uploads the Playwright report); make `check`, `build`, `audit` required checks. | FR-014 | `.github/workflows/ci.yml`, `playwright.config.ts` | AC-025 evidence (workflow + branch-protection screenshot) | code; branch protection → **requires separate authorization: external service change** (GitHub repo settings) |
| T-016 | Release candidate: cut `m1-rc1` per `docs/runbooks/release.md`; production deploy; smoke checklist (sign-in, create project, open workspace, `/api/liveblocks-auth` 200, `GET …/canvas` 404-for-new → 200-after-save). | FR-014 | git tag, `status.md` | AC-026 | production deploy and tag → **requires separate authorization** (release) |
| T-017 | **M1 acceptance run** executed per the AC-027 script on the release candidate; evidence folder `docs/acceptance/m1/<commit>/`; `status.md` "M1 acceptance run evidence" filled; D-019 answer recorded (AC-014); owner sign-off line. | FR-015, FR-009 | `docs/acceptance/m1/<commit>/*`, `status.md`, `context/progress-tracker.md` (owner updates milestone state) | AC-027 all steps Pass; AC-014 recorded | owner-witnessed; M2 authorization is a separate Gate-5 decision (D-002) |

## Ordering and parallelism

1. T-001 → T-002 → T-003 → T-004 (code; local only; can start before any dashboard exists).
2. T-005 → T-006, T-007, T-008 in any order (all [EXT]; T-005 first because the others store values into Vercel env).
3. T-009 → T-011 → T-015 (CI and headers), in parallel with T-012 once a preview exists (T-005).
4. T-010 and T-014 after the first preview with real data.
5. T-013 only on an owner decision.
6. T-016 → T-017 last; T-017 closes M1.

Each task is ≤ ~1 day. [EXT] tasks are typically < 1 hour of dashboard work plus evidence capture but are gated by authorization, not effort.

## Not in this plan

- Custom domain/TLS (owner's dashboard task; no code).
- Switching CSP to enforcing (F15-D2; a post-M1 task once a week of production reports is clean).
- Log drain configuration (optional under D-019 Option A; owner's dashboard task).
- Renovate/Dependabot (PROPOSED in testing-strategy.md; not configured).
- Trigger.dev project, `TRIGGER_SECRET_KEY`, and `syncVercelEnvVars` (F17).

The detailed step-by-step plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace back to these task IDs.
