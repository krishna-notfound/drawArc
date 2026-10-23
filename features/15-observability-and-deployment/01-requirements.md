# F15 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The repository shall be connected to a Vercel project with the Neon Vercel-managed integration so that every pull request deploys a preview with its own Neon branch `preview/<git-branch>` and receives `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) injected for that deployment only. | must | PRD-040, US-1 | AC-001 |
| FR-002 | The Vercel build command shall be `prisma migrate deploy && next build`, with `prisma.config.ts` reading `DATABASE_URL_UNPOOLED`, so that pending migrations are applied to the deployment's branch before the app builds; a failed migration fails the build. | must | PRD-040, D-010 | AC-002, AC-003 |
| FR-003 | Clerk shall use a Development instance for local + Preview and a Production instance for Production, each with its own publishable/secret keys and its own webhook endpoint (`/api/webhooks/clerk`) and `CLERK_WEBHOOK_SIGNING_SECRET`. | must | PRD-001, NFR-008 | AC-004 |
| FR-004 | Liveblocks shall use one project with separate development and production secret keys (`LIVEBLOCKS_SECRET_KEY`) and webhook secrets (`LIVEBLOCKS_WEBHOOK_SECRET_KEY`), mapped to Vercel environments; the plan question O-2 shall be answered before any public (production) deployment. | must | PRD-012, O-2 | AC-005 |
| FR-005 | A Vercel Blob store with `access: 'private'` shall exist and be linked to the project; on Vercel the app authenticates via OIDC (`BLOB_STORE_ID`), and `BLOB_READ_WRITE_TOKEN` is set only in local `.env.local` and CI. | must | D-009, NFR-008 | AC-006 |
| FR-006 | The environment-variable inventory (02-design.md) shall be complete and reflected in three places that agree: `lib/env.ts` schema, `.env.example`, and the Vercel project settings per environment; boot shall fail with a named missing variable when the schema is not satisfied. | must | NFR-008 | AC-007, AC-008 |
| FR-007 | Every route handler and Server Action shall obtain a `requestId` (F15-D1), pass it to every `logger.*` call for that request, and include it as `requestId` in every error JSON body / `ActionResult` error; logs for server errors shall include `userId` and `projectId` when resolved and `runId` for background runs. | must | PRD-041, NFR-009, US-2 | AC-009, AC-010, AC-011 |
| FR-008 | Uncaught client/server render errors shall be caught by `app/error.tsx` (recoverable: message + `requestId`/`digest` + Retry) and `app/global-error.tsx` (own `<html>/<body>`); unmatched routes and `notFound()` shall render `not-found.tsx`; the workspace segment `app/editor/[projectId]/error.tsx` shall offer "Back to projects" and Retry. No path renders a blank screen. | must | PRD-041, US-3 | AC-012, AC-013 |
| FR-009 | Error reporting shall follow D-019 as decided by the owner: baseline Option A (structured logs only) is implemented by this feature; Option B (Sentry) is specified and, if chosen, adds the files, env, and tests listed in 02-design.md as separate tasks. | must | D-019 | AC-014 |
| FR-010 | The performance envelope shall be verified on a deployed preview: 500 nodes / 800 edges fixture seeded via F13's snapshot API; drag p95 frame < 33 ms; local edit → remote render p95 < 500 ms; initial workspace load p95 < 3 s; room Storage JSON < 5 MB; plus a manual Chrome profile recorded with commit hash. | must | NFR-003, NFR-004 | AC-015, AC-016, AC-017, AC-018 |
| FR-011 | The security checklist shall pass on the release commit: security headers present; CSP in report-only mode including `img-src https://img.clerk.com`; `images.remotePatterns` limited to `https://img.clerk.com/**`; the built client bundle contains no server secret value; `npm audit --audit-level=high` is clean. | must | NFR-008, NFR-010, US-6 | AC-019, AC-020, AC-021, AC-022 |
| FR-012 | A backup/recovery runbook shall document and be rehearsed once on a preview: Neon branch/PITR restore, Liveblocks room export via `getStorageDocument`, Blob listing of `canvas/` and `specs/`, and re-seeding an empty room from the Blob snapshot (F13). | must | NFR-005, US-4 | AC-023 |
| FR-013 | A dependency update policy shall be written: pins per D-023, monthly review, `npm audit` in CI, each upgrade a separate task with its own check run; exceptions recorded in the decision log. | should | NFR-010 | AC-024 |
| FR-014 | A release procedure shall be written and the CI workflow extended with an `e2e-on-preview` job that runs `npm run e2e` against the PR's preview URL; production deploys automatically from `main`; releases are tagged `m1-rcN` / `m1`. | must | PRD-040, D-017 | AC-025, AC-026 |
| FR-015 | The M1 acceptance run (project-overview.md steps 1–8) shall be executed by two humans (or one human with two browsers) against a deployed environment and recorded step by step with evidence in `status.md`; M2 work is not authorized until every step passes. | must | D-002, US-5 | AC-027 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | `tests/e2e/perf.spec.ts` measures edit→remote render and initial load on the preview (AC-016, AC-017). |
| NFR-004 | Same spec seeds the 500/800 fixture, samples drag frame timing (AC-015), asserts Storage size (AC-018); manual Chrome profile (AC-015 evidence). |
| NFR-005 | Recovery runbook rehearsed (AC-023); reload tests live in F13 and are re-run in the acceptance run. |
| NFR-008 | Env inventory + `lib/env.ts` boot validation (AC-007/008); bundle secret scan (AC-021); Blob OIDC (AC-006). |
| NFR-009 | `requestId`/`userId`/`projectId`/`runId` in structured logs (AC-009–011); log inspection on preview (AC-011). |
| NFR-010 | Pins verified in `package.json` by `scripts/check-pins.ts` (AC-024); `npm audit` in CI (AC-022). |
| NFR-006 | Error and not-found pages are keyboard-operable with visible focus (AC-013 includes an a11y smoke). |

## UX and interaction behaviour

Only error surfaces are user-facing in this feature.

| Surface | File | Content and behaviour |
|---|---|---|
| Root error boundary | `app/error.tsx` (`'use client'`) | Centred card (`rounded-3xl`, `bg-surface`), heading "Something went wrong", body "The error has been recorded. Reference: `<digest or requestId>`" in `font-mono text-copy-muted`, primary Button "Retry" (calls `retry()`), secondary link "Back to projects" (`/editor`). Focus moves to the heading on mount. |
| Global error | `app/global-error.tsx` | Same card inside its own `<html lang="en" class="dark">`/`<body class="bg-base text-copy-primary">`; no dependency on the root layout or fonts (they may be the thing that failed). |
| Workspace error | `app/editor/[projectId]/error.tsx` | Same card over the canvas area; "Retry" re-renders the segment; "Back to projects" navigates to `/editor`. The navbar remains rendered (it belongs to the layout above the segment). |
| Not found | `app/not-found.tsx`, `app/editor/[projectId]/not-found.tsx` | Heading "Page not found" / "Project not found", link to `/editor`. The workspace gate (F04) renders `AccessDenied`, not `not-found`, for missing or forbidden projects — this file only covers `notFound()` calls from nested routes. |
| Status pill (existing, F05) | `components/editor/connection-status.tsx` | Unchanged; this feature only verifies that Liveblocks `useErrorListener` errors reach it with the error code text, never a toast-only path. |

Copy rule: never show stack traces, env names, or internal paths. Server errors arrive in `error.tsx` as a generic `Error` with `error.digest` (Next docs); the digest is the user-visible reference when no `requestId` is available.

Keyboard: Retry is the first focusable element; Escape does nothing (no modal semantics); all text ≥ 4.5:1 on `bg-surface`.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | `prisma migrate deploy` fails on a preview branch (e.g. conflicting migration) | Build fails; Vercel marks the deployment failed; no half-applied app; fix is a new migration in the PR. | AC-003 |
| EC-002 | A required env var is missing or malformed in one environment | `lib/env.ts` throws at module load naming the variable (never its value); the deployment's first request 500s with a log line `env.invalid`; `npm run build` locally also fails when `.env.local` is incomplete because `lib/env.ts` is imported by `next.config.ts`-independent server modules at build time only where evaluated (see 02-design "Boot validation"). | AC-008 |
| EC-003 | Clerk webhook delivered to the wrong environment (dev secret vs prod endpoint) | Signature verification fails → 400, no side effects (F02); logged with `requestId` and `svix-id`. | AC-004 |
| EC-004 | Liveblocks Free plan limits hit on a preview (10 connections/room, 3,000 collab minutes/month) | Room-full error 4005 is surfaced by F05's status pill; the limit is a product constraint (R-02). O-2 must be answered before production. | AC-005 |
| EC-005 | Blob store created as public by mistake | Cannot be changed after creation (store-level); the store must be deleted and recreated as private before any data is written; checklist item in T-005. | AC-006 |
| EC-006 | Same `requestId` reused across retries | `retry()` in `error.tsx` triggers a new request and therefore a new id; logs for a retried request are correlated by `userId` + path + time, not by id. | AC-010 |
| EC-007 | Error thrown inside the root layout (fonts, providers) | `app/error.tsx` cannot render (it is inside the layout); `app/global-error.tsx` renders a self-contained document. | AC-012 |
| EC-008 | Error during Liveblocks connection rather than React render | Not a boundary case: `useErrorListener` → status pill; the boundary stays untouched; verified in F05. | — (F05) |
| EC-009 | 500-node fixture exceeds limits | Fixture is 500 nodes / 800 edges, within the F13 caps (2,000 / 4,000) and the 4 MB body cap; a fixture over 4 MB is a bug in the fixture, not the app. | AC-018 |
| EC-010 | Perf test flakes on shared CI runners | `perf.spec.ts` runs only in the `e2e-on-preview` job with `retries: 0` and reports numbers; the pass/fail gate for NFR-004 is the recorded preview run plus the manual profile, not an arbitrary CI runner. | AC-015 |
| EC-011 | CSP report-only reports violations from browser extensions | Reports are triaged manually in the first week; only violations reproducible in a clean profile block the switch to enforcing (F15-D2). | AC-020 |
| EC-012 | Bundle scan finds a `pk_` publishable key | Publishable keys and `NEXT_PUBLIC_*` values are allowed in the bundle; the scan whitelists them explicitly and fails only on server-scope values. | AC-021 |
| EC-013 | Liveblocks room lost but Blob snapshot exists | Runbook: confirm room has zero nodes/edges, open the project as any member → the workspace gate seeds the room server-side from the snapshot (F13, D-034); a seed-failure banner means Liveblocks REST was unreachable — reopen later. | AC-023 |
| EC-014 | Blob snapshot lost but room intact | Runbook: open the project as an editor, make a trivial edit, wait for autosave (≥ 30 s) or hide the tab to flush; verify `Project.canvasSavedAt` updated. | AC-023 |
| EC-015 | Both lost | Neon still has the project row; the canvas is recoverable only from Liveblocks version history (24 h Free / 30 d Pro) via the dashboard — documented as the residual risk. | AC-023 |
| EC-016 | `npm audit` reports a high vulnerability with no fix | Merge blocked unless the owner records an exception in the decision log with an expiry date. | AC-022 |
| EC-017 | Acceptance run step fails | Record the step as Fail with evidence; open an issue referencing the owning feature's AC; re-run the full script after the fix (partial re-runs are not accepted for M1 sign-off). | AC-027 |
| EC-018 | Preview deployment of a PR that adds a migration is opened before the integration created the branch | The Neon integration creates the branch before the build runs (webhook on deployment creation); if the build cannot reach the DB, it fails fast with the Prisma connection error — retry the deployment. | AC-001 |
