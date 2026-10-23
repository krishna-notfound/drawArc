# F00 — Implementation Plan (outline)

## Dependencies to be installed

Versions marked VERIFIED come from the research notes (checked 2026-10-22); others are UNVERIFIED and T-001 records what `npm install` resolves. All use caret ranges per D-023 (none of the exact-pin packages are part of F00).

| Package | Range | Kind | Status |
|---|---|---|---|
| `zod` | `^4` | dependency | UNVERIFIED major (D-F00-7) |
| `clsx`, `tailwind-merge` | `^2` / `^3` | dependency | UNVERIFIED |
| `server-only` | `^0.0.1` | dependency | UNVERIFIED (package is a marker; version irrelevant) |
| `@types/node` | `^22` | dev | VERIFIED requirement (Vitest 5 peer) |
| `vitest` | `^5.0.5` | dev | VERIFIED |
| `vite` | `^8` | dev | VERIFIED (required by `@vitejs/plugin-react` 6) |
| `@vitejs/plugin-react` | `^6.1.2` | dev | VERIFIED |
| `vite-tsconfig-paths` | `^5` | dev | UNVERIFIED |
| `jsdom` | latest | dev | UNVERIFIED |
| `@testing-library/react` | `^16.3.3` | dev | VERIFIED |
| `@testing-library/dom` | `^10` | dev | VERIFIED (peer) |
| `@testing-library/jest-dom` | `^6` | dev | UNVERIFIED |
| `@playwright/test` | `^1.64.1` | dev | VERIFIED |
| `@next/playwright` | `16.4.2` (exact, matches `next`) | dev | VERIFIED (experimental) |
| `yaml` | `^2` | dev | UNVERIFIED (used only by the CI-workflow test) |
| `eslint-plugin-import` | already transitively via `eslint-config-next`; add as explicit dev dep only if `import/order` is not resolvable | dev | UNVERIFIED |

Not installed in F00: `@clerk/*`, `prisma`, `@liveblocks/*`, `@xyflow/react`, `shadcn`, `lucide-react`, `@clerk/testing` (F01/F02/F05).

## Environment variables added

None required. `.env.example` documents (all optional in F00): `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL_TEST`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `LIVEBLOCKS_SECRET_KEY`, `LIVEBLOCKS_WEBHOOK_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, `TRIGGER_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL`, plus the E2E-only keys `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD` and the switches `E2E_LIVEBLOCKS`, `CI` (documented, not in the Zod schema because they are read only by test configs).

## Migrations

None. No external service or dashboard is touched (Vercel, Neon, Clerk, GitHub repository secrets are F02/F15 and need their own authorization). The CI workflow file is committed but adding repository secrets is not part of F00.

## Tasks

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | Toolchain: `.nvmrc`, `engines`, `@types/node ^22`, Zod/clsx/tailwind-merge/server-only installed, test devDependencies installed, `.gitignore` additions, `package.json` scripts (`typecheck`, `lint`, `test`, `test:watch`, `check`, `check:bundle`, `e2e`, `e2e:install`); record resolved versions of UNVERIFIED packages in status.md | FR-001, FR-002, FR-009 | `.nvmrc`, `package.json`, `package-lock.json`, `.gitignore` | AC-001, AC-002 pass; `npm run typecheck` passes |
| T-002 | Vitest harness: `vitest.config.mts` (`tsconfigPaths()`, `react()`, `environment: 'jsdom'`, `setupFiles: ['tests/setup.ts']`, `include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts', '{app,components,lib,hooks}/**/*.test.{ts,tsx}']`, `globals: false`), `tests/setup.ts`, first harness test | FR-006 | `vitest.config.mts`, `tests/setup.ts`, `tests/unit/harness/rtl.test.tsx` | AC-008 passes |
| T-003 | `lib/env.public.ts` + `lib/env.ts` + `.env.example` + unit tests | FR-003, FR-004, FR-005, FR-018 | `lib/env.ts`, `lib/env.public.ts`, `.env.example`, `tests/unit/lib/env.test.ts`, `tests/unit/lib/env-public.test.ts`, `tests/unit/repo/env-example.test.ts` | AC-003, AC-004, AC-006, AC-007 pass |
| T-004 | `lib/errors.ts` + `lib/utils.ts` + tests | FR-012, FR-013 | `lib/errors.ts`, `lib/utils.ts`, `tests/unit/lib/errors.test.ts`, `tests/unit/lib/utils.test.ts` | AC-019–AC-022 pass |
| T-005 | `lib/logger.ts` + tests | FR-011 | `lib/logger.ts`, `tests/unit/lib/logger.test.ts` | AC-017, AC-018 pass |
| T-006 | ESLint flat config tightened + rule tests (ESLint API) + repo grep test for segment exports | FR-008, FR-016 | `eslint.config.mjs`, `tests/unit/lint/rules.test.ts`, `tests/unit/repo/segment-config.test.ts` | AC-011–AC-014 pass; `npm run lint` passes on the whole repo |
| T-007 | Baseline error pages (structure only) + tests | FR-014 | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `tests/unit/app/*.test.tsx` | AC-023–AC-025 pass |
| T-008 | Gate scripts: `scripts/check-prisma.mjs`, `scripts/check-bundle-secrets.mjs` + tests | FR-009, FR-017 | `scripts/*.mjs`, `tests/unit/scripts/*.test.ts` | AC-015, AC-028 pass; `npm run check` passes end to end |
| T-009 | Playwright scaffold: config, global setup placeholder, smoke spec, `e2e:install` documented; config unit test | FR-007 | `playwright.config.ts`, `tests/e2e/global.setup.ts`, `tests/e2e/smoke.spec.ts`, `tests/unit/repo/playwright-config.test.ts` | AC-009, AC-010 pass locally (`npm run e2e` output recorded) |
| T-010 | CI workflow + workflow test | FR-010, FR-017 | `.github/workflows/ci.yml`, `tests/unit/repo/ci-workflow.test.ts` | AC-016 passes; first CI run green on the F00 branch (AC-029 evidence) |
| T-011 | README rewrite + test; owner-edit preservation review | FR-015, FR-016 | `README.md`, `tests/unit/repo/readme.test.ts` | AC-026 passes; AC-027 recorded by reviewer |
| T-012 | Manual `server-only` verification with a throwaway fixture; record in status.md | FR-003 | (no committed files) | AC-005 recorded |

Order: T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012. Each task is one PR-sized change ≤ 1 day; T-003–T-005 are independent after T-002 and may be parallelised.

Notes for Gate 6 planning:
- T-006 may surface existing lint violations in the owner's `app/page.tsx` / `app/layout.tsx`; those files are not to be edited (FR-016). If a new rule flags them, add a file-scoped override and report it rather than editing the files.
- `tests/e2e/**` runs under Playwright, not Vitest; `vitest.config.mts` `include` must not match `tests/e2e`.
- The detailed plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace to these task IDs.
