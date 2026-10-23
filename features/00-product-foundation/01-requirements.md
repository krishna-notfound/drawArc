# F00 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority (must/should) | Source (PRD/US) | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The repository shall pin Node 22: `.nvmrc` containing `22`, `package.json` `engines.node` = `>=22.12 <25`, `@types/node` `^22`. | must | code-standards "Dependencies", D-017 | AC-001 |
| FR-002 | `package.json` shall follow the pin policy D-023 whenever the packages exist: `@xyflow/react` `~12.12`, every `@liveblocks/*` the same exact version, `prisma`/`@prisma/client`/`@prisma/adapter-neon` `~7.10`; all other dependencies caret. A unit test shall enforce this. | must | NFR-010, D-023 | AC-002 |
| FR-003 | `lib/env.ts` shall validate `process.env` with Zod at module load, export a typed `env` (server) and re-export `publicEnv`, import `server-only`, and on failure throw an `Error` listing the offending key names only. | must | NFR-008, US-2, security-model "Secrets" | AC-003, AC-004, AC-005 |
| FR-004 | `lib/env.public.ts` shall expose only `NEXT_PUBLIC_*` keys, each referenced as a literal `process.env.NEXT_PUBLIC_X` expression so Next.js can inline it. | must | NFR-008 | AC-006 |
| FR-005 | `.env.example` shall list every key in the env schema (server and public) with a comment naming the feature that activates it and no values. | must | security-model "Secrets" | AC-007 |
| FR-006 | Vitest 5 shall run unit tests under jsdom with `vite-tsconfig-paths` and `@vitejs/plugin-react`, using `tests/setup.ts` (jest-dom matchers, RTL `cleanup`, env placeholders); `npm run test` = `vitest run`. | must | D-017, US-1 | AC-008 |
| FR-007 | Playwright 1.64 shall be configured with a `setup` project (global setup file, Clerk call added by F02), a `chromium` project depending on it, a `webServer` for Next, and a guarded Liveblocks dev-server `webServer` entry enabled by `E2E_LIVEBLOCKS=1` (activated by F05); `npm run e2e` = `playwright test`. | must | D-017 | AC-009, AC-010 |
| FR-008 | ESLint flat config shall error on: `console.*` (allowed only in `scripts/**`); `process.env` member access outside the allow-list (`lib/env.ts`, `lib/env.public.ts`, `next.config.ts`, `vitest.config.mts`, `playwright.config.ts`, `prisma.config.ts`, `scripts/**`, `tests/setup.ts`, `tests/e2e/**`); imports of `@/app/*`, `@/components/*`, `@/hooks/*` from `lib/**` and `trigger/**`; `export const runtime|dynamic|revalidate|fetchCache|dynamicParams` under `app/**`; non-type imports of types (`consistent-type-imports`); unordered imports (`import/order`). | must | code-standards Next 16 rules 2, 7; "Validation and boundaries"; US-3 | AC-011, AC-012, AC-013, AC-014 |
| FR-009 | `npm run check` shall be `next typegen && tsc --noEmit && eslint . && vitest run && node scripts/check-prisma.mjs` (`next typegen` generates route-aware types such as `LayoutProps`, which a fresh clone lacks), where the script runs `prisma validate` if `prisma/schema.prisma` exists and otherwise prints `prisma validate: skipped (no schema yet)` and exits 0. | must | testing-strategy "Quality gate" | AC-015 |
| FR-010 | A GitHub Actions workflow `.github/workflows/ci.yml` shall run on `push` (branches `main`, `master`) and `pull_request`: Node from `.nvmrc`, `npm ci`, `npm run check`, `npm run build`, `npm run check:bundle`, `npm audit --audit-level=high`. | must | PRD-040, NFR-010, US-4 | AC-016 |
| FR-011 | `lib/logger.ts` shall export `logger` with `debug/info/warn/error(ctx, msg)` and `child(bindings)`, emitting one JSON line per call with `level`, `time`, `msg`, and the context fields (`requestId`, `userId`, `projectId`, `runId` when present), filtered by `LOG_LEVEL`, serialising `err` as `{ name, message, stack }`. | must | NFR-009, code-standards "Logging" | AC-017, AC-018 |
| FR-012 | `lib/errors.ts` shall define the closed union `ErrorCode = UNAUTHENTICATED \| FORBIDDEN \| NOT_FOUND \| VALIDATION \| CONFLICT \| RATE_LIMITED \| UPSTREAM \| INTERNAL`, `AppError`, `AccessError`, `ActionResult<T>`, `ActionError`, `httpStatusFor(code)` (401/403/404/400/409/429/502/500; `VALIDATION` may carry a 422 override for semantic/limit violations, D-036) and `errorResponse(err)` returning `NextResponse.json({ error: { code, message, fieldErrors? } }, { status })` for `AppError` and `ZodError`, rethrowing anything else. These are the only definitions of these types in the repo (D-036). | must | code-standards "Logging and errors", architecture "Error handling", D-036 | AC-019, AC-020, AC-021 |
| FR-013 | `lib/utils.ts` shall export `cn(...inputs)` = `twMerge(clsx(inputs))`. | must | code-standards "Styling" | AC-022 |
| FR-014 | `app/error.tsx` (`'use client'`, props `{ error, retry }`) shall render a heading, the `error.digest` when present, and a "Try again" button calling `retry`; `app/global-error.tsx` shall render its own `<html>`/`<body>`; `app/not-found.tsx` shall render a heading and a link to `/`. No segment-config exports. | must | PRD-041 (baseline), architecture "Error handling" | AC-023, AC-024, AC-025 |
| FR-015 | `README.md` shall describe drawArc (name, one-paragraph purpose, prerequisites, setup from `.env.example`, every npm script, where `context/` and `features/` live, the reference-material rule) and shall not mention "Ghost AI" except as the former name. | must | project-overview "What drawArc is" | AC-026 |
| FR-016 | F00 shall not modify `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `AGENTS.md`, or `No_touch_ai/**`, and shall leave `next.config.ts` flags `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback` unchanged. | must | D-003, D-004, ai-workflow-rules | AC-027 |
| FR-017 | After `npm run build`, no server-only secret value shall appear in `.next/static/**`; `npm run check:bundle` shall grep for a CI-provided sentinel in every server key and fail if found. | must | NFR-008, US-5 | AC-028 |
| FR-018 | `npm run build` shall pass with no `.env.local` present (all service keys optional in F00). | must | G-1 | AC-029 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-007 | `tsc --noEmit` with `strict` is the first step of `check`; `@typescript-eslint/no-explicit-any` set to `error` (only `lib/generated/**` and typed boundary adapters may override per file). |
| NFR-008 | `server-only` on `lib/env.ts`; public keys isolated in `lib/env.public.ts`; bundle sentinel check in CI (FR-017); env validated at boot (FR-003). |
| NFR-009 | `lib/logger.ts` structured fields; later features attach `requestId/userId/projectId/runId`. |
| NFR-010 | Pin test (FR-002); `npm audit --audit-level=high` in CI (FR-010). |

## UX and interaction behaviour

F00 has three user-visible surfaces, all unstyled until F01 (tokens do not exist yet; semantic HTML only, no colour classes):

| Surface | Copy (PROPOSED) | Behaviour |
|---|---|---|
| `app/error.tsx` | h1 "Something went wrong"; p "Reference: {digest}" (only when `error.digest` exists); button "Try again" | Button calls `retry()`; the raw error message is never rendered (server errors arrive as generic `Error` with `digest`). |
| `app/global-error.tsx` | h1 "drawArc could not load"; button "Reload" | Renders own `<html lang="en"><body>`; button calls `retry()`. |
| `app/not-found.tsx` | h1 "Page not found"; link "Go to drawArc home" → `/` | Static; no data. |

Developer-facing behaviour: an env failure prints `Invalid environment: CLERK_SECRET_KEY (invalid_string), DATABASE_URL (required)` style messages — key and Zod issue code, never the value. `LOG_LEVEL` defaults to `info` (`debug` in `development`).

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | `process.env` value fails the schema (e.g. `CLERK_SECRET_KEY` set but not `sk_`-prefixed) | module load throws; message lists key + issue code, no value; `next build`/`next start` abort | AC-004 |
| EC-002 | Client component imports `@/lib/env` | build error from `server-only` (Next's own message) | AC-005 |
| EC-003 | `lib/env.public.ts` reads a key via dynamic access (`process.env[name]`) | lint error (`no-restricted-syntax` selector targets computed member access too) and the literal-reference unit test fails | AC-006 |
| EC-004 | `prisma/schema.prisma` absent (F00–F01) | `check` prints the skip line and passes | AC-015 |
| EC-005 | `prisma/schema.prisma` present but `prisma` CLI not installed | script exits 1 with `prisma validate: schema present but prisma is not installed` | AC-015 |
| EC-006 | `npm audit` reports a high advisory in a transitive dependency with no fix | CI fails; the owner records an exception in `decision-log.md` and the workflow gains `--omit=dev` or an `audit-ci` allow-list in a separate, authorized task — never silently | AC-016 (Manual note) |
| EC-007 | `LOG_LEVEL=warn` and `logger.info` called | nothing written | AC-018 |
| EC-008 | `logger.error({ err })` where `err` is not an `Error` (string, object) | serialised as `{ name: 'NonError', message: String(err) }` | AC-018 |
| EC-009 | Context contains a key named `password`, `token`, `secret`, `authorization` (case-insensitive) | value replaced by `[redacted]` | AC-018 |
| EC-010 | `errorResponse` receives a plain `Error` | rethrown (unexpected error reaches Next's 500 / `error.tsx`); never converted to a 4xx | AC-021 |
| EC-011 | `AppError('VALIDATION', msg, { status: 422 })` | allowed; any other code with a status override throws at construction | AC-020 |
| EC-012 | `retry()` throws again in `error.tsx` | boundary re-renders with the new error; no infinite loop (React semantics) | AC-023 |
| EC-013 | Build run with `CI=true` and no env | passes (FR-018); the `check:bundle` sentinel step runs with sentinel values injected by the workflow only | AC-028, AC-029 |
| EC-014 | Local Node is 24.x (owner's machine) while `.nvmrc` says 22 | `engines` range `>=22.12 <25` accepts it; CI uses 22; mismatch is recorded, not blocked | AC-001 |
| EC-015 | Two Playwright `webServer` entries and port 1153 already in use | `reuseExistingServer: !process.env.CI` lets a running dev server be reused locally; CI fails fast with the Playwright port error | AC-010 (Manual note) |
