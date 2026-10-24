# drawArc — Progress Tracker

> Update whenever the gate, authorized task, or verified state changes. Reflect the **actual** state of the repository, never the intended one. Dates are absolute.

## Current gate

**Gate 6 for F00** (as of 2026-10-23): F00 spec approved; implementation plan awaiting owner review. All other features remain at Gate 5 (drafted, awaiting approval). Audit report: `features/AUDIT-2026-10-22.md`.

## Authorized task

**F00 implementation planning only** (2026-10-23). Writing and reviewing `docs/superpowers/plans/2026-10-23-f00-product-foundation.md`. No code, dependency installs, or external-service changes until the owner approves the plan and chooses an execution method.

Separately authorized and done 2026-10-23 — environment-only setup (no SDKs, no app code, no repo files other than git-ignored `.env.local`):
- Neon: branch `development` (`br-empty-wave-aod9bhsk`) created from `production` in project `lucky-mud-20214365` (org `org-billowing-poetry-68620217`, region `aws-ap-southeast-1`, Postgres 18.6). `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for `development` in `.env.local`; both verified with a read-only query (0 tables). `production` untouched.
- Clerk: dev keys (`pk_test_`/`sk_test_`) for app `app_3GSMeMV3U7qnsq7rwwcbD3LtaXK` in `.env.local`.
- Trigger.dev: dev `TRIGGER_SECRET_KEY` (`tr_dev_`) for project `proj_itqgsfuxxrlvptczzfnf` added by the owner.
- Liveblocks: dev secret key (`sk_dev_`, Development project) in `.env.local`; Liveblocks MCP server added at local scope (`~/.claude.json`, key read from `.env.local`) and connected. The production `sk_prod_` key is held by the owner for F15 (Vercel production).
- Open: Vercel functions region should be `sin1` to match Neon `aws-ap-southeast-1` (decide in F15).

## What is approved (owner, 2026-10-22)

See [decision-log.md](decision-log.md) D-001 … D-011: product identity, milestones, tenancy, snapshot store (Blob), LLM deferral, no public links, no freehand, Prisma 7, local User table.

## What is proposed and awaiting Gate 5 approval

- All `context/` documents (this planning package).
- Feature packages `features/00` – `features/21`.
- Decisions D-012 … D-037 (global) plus the feature-local decisions indexed under D-035, and open items D-019, O-1 … O-4 in the decision log.

## Repository state (verified 2026-10-22)

- Scaffold only: Next 16.4.2 / React 19.3 / Tailwind v4. No planned libraries installed.
- Uncommitted owner edits preserved: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, deleted `public/*.svg`.
- Untracked and created by planning: `CLAUDE.md`, `context/*`, `features/*`.
- Reference material: `No_touch_ai/` (read-only).

## Completed and verified

- Gate 1 discovery report (chat, 2026-10-22).
- Gate 2 research: React Flow 12.12.0, Liveblocks 3.24.4, Clerk 7.9.19, Prisma 7.10.1 / Neon, Trigger.dev 4.7.7, Vercel Blob 2.8.2, Next.js 16.4.2 local docs, test tooling (2026-10-22). Findings embedded in `architecture-context.md`, `security-model.md`, `testing-strategy.md`, `decision-log.md`.

## Feature status summary

| # | Feature | Milestone | Status |
|---|---|---|---|
| 00 | product-foundation | M1 | Completed — merged to `main` via PR #1 (2026-10-23) |
| 01 | app-shell-and-design-system | M1 | Completed — merged to `main` via PR #2 (2026-10-23) |
| 02 | authentication-and-users | M1 | Completed — merged to `main` via PR #3 (2026-10-24) |
| 03 | projects-data-layer-and-api | M1 | Completed — merged to `main` via PR #4 (2026-10-24) |
| 04 | editor-home-and-workspace-shell | M1 | Completed — merged to `main` via PR #6 (2026-10-24) |
| 05 | realtime-room-infrastructure | M1 | Completed — merged to `main` via PR #7 (2026-10-24) |
| 06 | base-collaborative-canvas | M1 | Completed — merged to `main` via PR #8 (2026-10-24) |
| 07 | shapes-and-node-creation | M1 | drafted |
| 08 | node-editing | M1 | drafted |
| 09 | edges-and-connections | M1 | drafted |
| 10 | canvas-ergonomics-and-keyboard | M1 | drafted |
| 11 | presence-and-cursors | M1 | drafted |
| 12 | sharing-and-access-control | M1 | Verification (2026-10-24): verified incl. combined check with F06; PR open |
| 13 | persistence-and-recovery | M1 | drafted |
| 14 | starter-templates | M1 | drafted |
| 15 | observability-and-deployment | M1 | drafted |
| 16 | ai-sidebar-and-room-chat | M2 | drafted |
| 17 | ai-design-agent | M2 | drafted |
| 18 | spec-generation | M3 | drafted |
| 19 | import-export | Future | deferred (overview only) |
| 20 | public-share-links | Future | deferred (overview only) |
| 21 | freehand-strokes | Future | deferred (overview only) |

Status vocabulary (per `features/README.md`): `drafted` → `reviewed` → `approved` → `planned` → `in-progress` → `verified` → `released`; `deferred` for future packages.

## Blockers

None for planning. Implementation is blocked on Gate 5 approval.

## Risk register

| ID | Risk | Likelihood / impact | Mitigation | Owner feature |
|---|---|---|---|---|
| R-01 | Same-key LWW: two users (or user + agent) editing one node; undo does not rebase | Medium / Medium | Document behaviour; agent edits only nodes it created; version snapshot before agent runs; E2E convergence tests | 06, 10, 17 |
| R-02 | Liveblocks 10 connections/room (Free/Pro); Free is non-commercial | High if >10 users / Low | Product constraint (non-goal); Pro plan before public use (O-2); room-full error surfaced in UI | 05 |
| R-03 | Access revocation not immediate; token TTL unpublished | Medium / High (security) | Mandatory KICK broadcast + client leave; E2E test ≤ 5 s | 05, 12 |
| R-04 | Blob snapshot write and Postgres pointer not atomic; CDN staleness; per-op quota | Medium / Medium | D-009 mitigations; `useCache: false`; ≥ 30 s debounce; size cap | 13 |
| R-05 | `@liveblocks/react-flow` is 6 months old; `updateNode` merge depth and `mutateStorage` runtime semantics undocumented | Medium / Medium | Spike in feature 05 (local dev server) before 06; pin version | 05, 17 |
| R-06 | React Flow 13 pre-release; Prisma 8 RC on `latest` | High (if unpinned) / Medium | Exact pins (D-023); upgrade as separate tasks | 00 |
| R-07 | Next 16 Cache Components validation errors on auth pages | High (first time) / Low | Code standards rules 1–4; `error.tsx`; E2E `instant()` checks | 02, 04 |
| R-08 | `storageUpdated` webhook throttled/unreliable | Certain / Low | Client-driven autosave is primary; webhook is a backstop only | 13 |
| R-09 | LLM output invalid or overlapping layout (M2) | High / Medium | Zod validation of tool calls; layout pass; reject-and-report; canonical prompt suite | 17 |
| R-10 | Node ≥ 22.12 requirement for Vitest 5 vs local environment | Low / Low | `.nvmrc`, CI matrix | 00 |

## Session notes

- 2026-10-22: Planning session. Owner answered decision questions D-001–D-011 via cross-questioning. Research reports were produced in the session scratchpad (not in repo); their conclusions are embedded in the context files with dates.

## Next step

Gate 5: owner reviews `context/`, `features/`, and `features/AUDIT-2026-10-22.md`; resolves the open decisions listed in the decision log and audit; approves feature packages individually; names the first authorized implementation task (recommended: feature `00` product-foundation, task T-001, planned via `superpowers:writing-plans`).
