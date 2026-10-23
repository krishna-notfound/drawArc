# F15 — Observability and Deployment

| Field | Value |
|---|---|
| Milestone | M1 (closes M1) |
| Depends on | F00 (toolchain, `lib/env.ts`, `lib/logger.ts`, CI workflow), F01 (`error.tsx` shells), F02 (Clerk), F03 (Prisma/Neon), F05 (Liveblocks), F12 (sharing — acceptance run step 2/6), F13 (snapshot API — perf fixture seeding, recovery), F14 (templates — acceptance run step 7); transitively F04–F11 |
| Depended on by | F16, F17, F18 (M2/M3 start only after this feature's M1 acceptance run passes — D-002); F17/F18 add rows to this feature's env inventory |
| Product requirements | PRD-040, PRD-041, NFR-003, NFR-004, NFR-008, NFR-009, NFR-010 |
| Status | see status.md |

## Purpose

F15 turns the M1 feature set into a deployed, observable, recoverable product and executes the formal **M1 acceptance run** that is the definition of "done" for the MVP (project-overview.md). It is last in the M1 order because it has nothing of its own to deploy until F00–F14 exist, and because its acceptance criteria are the exit criterion of the milestone: a deployed preview/production environment on Vercel with Neon preview branches, Clerk and Liveblocks configured per environment, a private Blob store, validated environment variables, structured logs with request context, recoverable error boundaries, a verified performance envelope (500 nodes / 800 edges), a security checklist run against the built artifact, and written runbooks for backup, recovery, dependency updates, and release.

## Problem statement and goals

- Problem: F00–F14 specify application behaviour but not the environments it runs in, how failures are seen, how data is recovered, or how the milestone is proven. Without F15 "M1 done" is unmeasurable (principle 9: complete means verified, not compiled).
- G-1: A pull request produces a preview deployment with its own Neon branch and migrations applied, with zero manual steps after the integration is configured.
- G-2: Every server error and every expected error response carries a `requestId` that can be found in Vercel runtime logs together with `userId`/`projectId` when known (NFR-009).
- G-3: No uncaught client error shows a blank screen; the root and segment error boundaries render a recoverable UI (PRD-041).
- G-4: The NFR-003/NFR-004 envelope is measured on a deployed preview and recorded with a commit hash.
- G-5: The security checklist (headers, CSP, remote images, bundle secret scan, `npm audit`) passes on the release commit (NFR-008, NFR-010).
- G-6: The M1 acceptance run (steps 1–8) passes on a deployed environment with evidence recorded in `status.md`.

## Scope

In scope:
- Vercel project, Neon Vercel-managed integration (preview branch per PR), build command with `prisma migrate deploy`.
- Clerk development vs production instances, Liveblocks project/environment keys, Blob private store, webhook endpoints per environment.
- Environment-variable inventory (Development / Preview / Production) and its validation in `lib/env.ts` (F00) — this feature verifies completeness; it does not redefine the schema.
- Structured logging conventions and `requestId` propagation (`lib/logger.ts`, `lib/request-id.ts`).
- Review and completion of `app/error.tsx`, `app/global-error.tsx`, `not-found.tsx` per segment.
- D-019 (error-reporting SaaS) presented as an OPEN decision with both options fully specified; Option A is implemented as the baseline.
- Performance verification procedure (scripted + manual), security checklist, backup/recovery runbook, dependency update policy, release procedure, CI `e2e-on-preview` job.
- The M1 acceptance run script with evidence fields.

Out of scope / non-goals:
- Any new product behaviour, routes, or Server Actions (none; AUTHZ-MATRIX is therefore not applicable to this feature).
- Trigger.dev project/env setup and `TRIGGER_SECRET_KEY` (F17); LLM provider key (F17, after SDK selection); spec download hardening (F18). This feature only reserves rows for them in the inventory.
- A periodic Blob/room cleanup task (future; data-ownership.md rule 7).
- Custom domains, DNS, and TLS (owner's dashboard task, no code impact; not specified here).
- Renovate/Dependabot configuration (PROPOSED in testing-strategy.md, not configured in M1).
- Multi-region, scaling, or load testing beyond NFR-004.

## User stories

- US-1: As the owner (human), I want every PR to deploy to a preview URL with its own database branch so that I can review features against real services without touching production data.
- US-2: As a developer debugging a report, I want the `requestId` shown in an error response or UI to find the server log line with `userId` and `projectId` so that I can reproduce the failure.
- US-3: As a user, when something unexpected breaks in the workspace I want a "Something went wrong — Retry" view rather than a blank page so that I can recover without losing my place.
- US-4: As the owner, I want a written, rehearsed procedure to restore a project's canvas after a Liveblocks room or Blob snapshot is lost so that a single-store failure is not data loss.
- US-5: As the owner, I want a checklist that proves M1 on the deployed app with recorded evidence so that the decision to start M2 is based on facts.
- US-6 (abuse/failure story): As an attacker inspecting the client bundle I must not find any server secret; as a non-member I must still receive the identical access-denied response on production as on local (no environment-specific leak).

## Key decisions referenced

- D-002 (M2 starts only after the M1 acceptance run passes), D-009/D-022 (Blob private store, `useCache: false`), D-010 (Prisma 7, `prisma.config.ts` with unpooled URL), D-015 (access tokens; KICK), D-017 (test toolchain; L3 against preview), D-019 (**OPEN** — error SaaS; both options specified in 02-design.md), D-023 (pins), O-2 (Liveblocks plan — Free is non-commercial).
- Introduced by this feature (PROPOSED; copy to the decision log on approval):
  - **F15-D1** — `requestId` is generated per request with `crypto.randomUUID()` in `lib/request-id.ts` and echoed in every error JSON body and in `error.digest`-matched logs. Rationale: Vercel's own request id header is UNVERIFIED and Server Actions have no stable header access; a self-generated id works identically in local, CI, and Vercel.
  - **F15-D2** — CSP ships in `Content-Security-Policy-Report-Only` for the whole of M1 and is switched to enforcing as a separate task after one week of zero violations on production. Rationale: Clerk, Liveblocks WS hosts, and Trigger.dev realtime hosts are only partially verified; enforcing early would risk breaking auth or collaboration.
  - **F15-D3** — Performance evidence is a file in the repository (`docs/perf/<commit>.md` with the Chrome profile summary) referenced from `status.md`, not an external link. Rationale: evidence must survive dashboard retention limits.
  - **F15-D4** — Production deploys are automatic on merge to `main`; previews are per PR; there is no separate staging environment in M1. Rationale: Neon preview branches already give an isolated environment per change; a third environment adds env-var surface without a reviewer.

## Reference material

- context: project-overview.md (M1 acceptance run), product-requirements.md (PRD-040/041, NFR-003/004/008/009/010), architecture-context.md ("Error handling and observability", "Persistence architecture"), security-model.md ("Secrets and configuration", "Deletion and data lifecycle"), code-standards.md ("Logging and errors", "Dependencies"), testing-strategy.md ("Performance tests", "Dependency and security checks", "Quality gate"), data-ownership.md (recovery column), decision-log.md (D-019, O-2).
- Research (checked 2026-10-22): Neon Vercel-managed integration — https://neon.com/docs/guides/vercel-managed-integration (preview branch per deployment, injected `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, build-command migrations); Vercel Blob private storage — https://vercel.com/docs/vercel-blob/private-storage and https://vercel.com/docs/vercel-blob (store-level access mode, OIDC auth), SDK — https://vercel.com/docs/vercel-blob/using-blob-sdk (`list`, `get`); Clerk CSP hosts — https://clerk.com/docs/guides/secure/best-practices/csp-headers (`img-src https://img.clerk.com`); Liveblocks pricing/limits — https://liveblocks.io/pricing (Free non-commercial, 10 connections/room); Next.js 16.4.2 local docs `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` and `03-file-conventions/error.md` (error boundary contract).
- UNVERIFIED (must be checked before the relevant task): Vercel request-id header name; exact Liveblocks and Trigger.dev CSP hosts; Neon point-in-time restore page (https://neon.com/docs/guides/branch-restore); Liveblocks dashboard Storage export; `@sentry/nextjs` version and Next 16 compatibility (Option B only).
- Reference prompts (`No_touch_ai/`, product intent only): none specific to deployment; `current-issues/*.md` bugs are owned by F07/F10/F13 and are re-run here as part of the acceptance run, not re-specified.
