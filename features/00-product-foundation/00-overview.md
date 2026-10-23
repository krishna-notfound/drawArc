# F00 — Product Foundation

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | — (first feature) |
| Depended on by | F01 (tokens, shell), F02 (env keys, `lib/errors.ts`, `lib/logger.ts`, test harness), every later feature (quality gate, CI) |
| Product requirements | PRD-040 (CI quality gate half; Vercel/Neon deployment half is F15), NFR-007, NFR-008, NFR-010 |
| Status | see status.md |

## Purpose

F00 turns the bare `create-next-app` scaffold into a repository that can prove anything: a pinned Node toolchain, a validated environment boundary, a four-layer test harness (L0–L3) with real commands, a lint configuration that mechanically enforces the Next.js 16 Cache Components rules and the dependency direction, the cross-cutting server utilities every feature imports (`lib/env.ts`, `lib/logger.ts`, `lib/errors.ts`, `lib/utils.ts`), baseline error boundaries, and a CI workflow that runs the quality gate. It sits first because every later acceptance criterion names a layer and a command that F00 makes real. It installs no product library (no Clerk, Prisma, Liveblocks, React Flow) and touches no external dashboard.

## Problem statement and goals

- Problem: the scaffold has no tests, no env validation, no logging or error conventions, `@types/node ^20` (below Vitest 5's peer range), a default ESLint config that permits `console.*`, `process.env` reads anywhere, and the segment-config exports that break Cache Components. Without these, feature specs cannot be verified and the "quality gate" in `testing-strategy.md` is a sentence, not a command.
- G-1: `npm run check` and `npm run build` pass on a clean clone with Node 22 and no `.env.local` (all service keys are optional until their owning feature activates them).
- G-2: `npm run e2e` runs a smoke test against the local app; the Playwright project structure already has the slots F02 (Clerk) and F05 (Liveblocks dev server) fill in.
- G-3: CI runs `check`, `build`, a bundle-secret check, and `npm audit --audit-level=high` on every push and PR.
- G-4: A violation of the Cache Components rules (`runtime`/`dynamic`/`revalidate`/`fetchCache`/`dynamicParams` exports) or of "`lib/env.ts` is the only reader of `process.env`" fails lint (L0), not code review.

## Scope

In scope:
- `.nvmrc` (`22`), `engines.node`, `@types/node ^22`; dependency pin policy (D-023) encoded in `package.json` and checked by a unit test.
- `lib/env.ts` (server, `server-only`) + `lib/env.public.ts` (client-safe `NEXT_PUBLIC_*`) with Zod; `.env.example` documenting every M1 key.
- Vitest 5 + `@testing-library/react` 16 + jsdom (`vitest.config.mts`, `tests/setup.ts`); Playwright 1.64 scaffold (`playwright.config.ts`, project-based global setup placeholder for `@clerk/testing`, guarded Liveblocks dev-server `webServer` entry); `@next/playwright` `instant()` available.
- ESLint flat config tightened: `no-console` (except `scripts/**`), `process.env` restriction, dependency-direction import restriction, segment-config export ban, `import/order`, `consistent-type-imports`.
- Scripts: `check`, `typecheck`, `test`, `e2e`, `check:prisma` (guarded until a schema exists), `check:bundle`.
- `.github/workflows/ci.yml`.
- `lib/logger.ts`, `lib/errors.ts`, `lib/utils.ts` (`cn()`), `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` (structure and behaviour; token styling arrives with F01).
- `README.md` rewritten for drawArc; `AGENTS.md` left as `next dev` writes it; owner's uncommitted edits to `app/page.tsx`, `app/layout.tsx`, `app/globals.css` and the deleted `public/*.svg` are preserved untouched.
- `next.config.ts` keeps `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true` exactly as they are.

Out of scope / non-goals:
- Design tokens, shadcn, fonts/metadata copy (F01). Clerk, Prisma schema, first migration (F02). Vercel project, Neon integration, GitHub secrets, preview deployments, Sentry (F15; D-019 open). Any Vercel/Neon/Clerk dashboard change (separately authorized). Dependabot/Renovate (PROPOSED in testing-strategy, not configured). MSW (not adopted, D-017). Husky/lint-staged pre-commit hooks (never in M1: CI is the gate).

## User stories

- US-1: As a contributor, I want `npm run check` to run types, lint, unit tests, and schema validation in one command so that "done" is a command output, not a claim.
- US-2: As a contributor, I want a missing or malformed env var to fail at boot with the key name (never its value) so that misconfiguration is found before a request is served.
- US-3: As a reviewer, I want lint to reject `console.*`, `process.env` outside `lib/env.ts`, `lib/` importing `app/` or `components/`, and Cache-Components-incompatible exports so that these rules do not depend on memory.
- US-4: As the owner, I want CI to block a merge when the gate, the build, or `npm audit --audit-level=high` fails so that `main` is always releasable.
- US-5 (abuse): As a developer, I must not be able to import a server secret into a client component without a build error, and no secret string may appear in `.next/static`.

## Key decisions referenced

- D-017 (test toolchain), D-023 (pins), D-036 (`lib/errors.ts` — `AccessError`, `ActionResult`, `ErrorCode` — is owned by F00; `VALIDATION` is 400 by default and 422 only on explicit override), NFR-007/008/010 — applied as specified.
- PROPOSED D-F00-1: `lib/env.ts` declares every M1 key from day one with service keys `.optional()`; the feature that installs a service flips its keys to required ("activation"). Rationale: one schema, no drift, `npm run check` passes with no secrets in CI.
- PROPOSED D-F00-2: `env` is split into `lib/env.ts` (server, imports `server-only`) and `lib/env.public.ts` (client-safe); `lib/env.ts` re-exports `publicEnv`. Rationale: `server-only` is the mechanism that makes NFR-008 a build error; architecture-context describes one file, this is the minimal split that keeps that promise.
- PROPOSED D-F00-3: `check` runs `node scripts/check-prisma.mjs`, which executes `prisma validate` only when `prisma/schema.prisma` exists; F02 (which introduces the schema) replaces it with the literal `prisma validate`.
- PROPOSED D-F00-4 (now recorded globally as D-036): `lib/errors.ts` owns `ErrorCode` (eight codes incl. `INTERNAL` 500, per `code-standards.md` "Logging and errors"), `AppError`, `AccessError`, `ActionResult`, `ActionError`, `httpStatusFor`, `errorResponse`. `VALIDATION` maps to 400 (malformed input); a status override to 422 is allowed only for `VALIDATION` (semantic/limit violations: node/edge caps, size caps, schema failures in F13). Later features consume these types; none redefines them (F03 adds only `toActionError`).
- PROPOSED D-F00-5: `lib/logger.ts` writes JSON lines with `process.stdout/stderr.write`, so `no-console` needs no exception for it.
- PROPOSED D-F00-6: Error pages ship in F00 with semantic markup and behaviour only; F01 applies tokens (F01/T-012). Rationale: tokens do not exist yet and `code-standards.md` forbids raw colour classes.
- PROPOSED D-F00-7: Zod pinned `^4` (version not covered by research; UNVERIFIED, T-001 confirms the installed major and records it in status.md).
- PROPOSED D-F00-8: Playwright `webServer` runs `next dev` locally and `next start` (after the CI build) when `CI` is set.

## Reference material

- `context/testing-strategy.md` (layers, commands), `context/code-standards.md` (Next 16 rules, logging, errors, dependencies), `context/security-model.md` "Secrets and configuration" (env key list), `context/architecture-context.md` "Error handling and observability".
- Research: `scratchpad/research/nextjs-testing.md` (Cache Components rules, `proxy.ts`, Vitest 5 / Playwright 1.64 / `@next/playwright` facts, checked 2026-10-22).
- Reference prompt `No_touch_ai/.../feature-specs/01-design-system.md` for `lib/utils.ts cn()` (product intent only).
- Repository facts (2026-10-22): `package.json` has `@types/node ^20`; local Node is v24.21.0 (see open issue in status.md); branch is `master`, default branch named `main` in git metadata.
