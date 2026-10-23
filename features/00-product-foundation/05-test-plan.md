# F00 — Test Plan

Layers and commands are those defined in `context/testing-strategy.md`. F00 is the feature that makes them run; its own tests therefore double as the harness smoke test.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/repo/toolchain.test.ts` | read `.nvmrc`, `package.json` | assert values | `.nvmrc` = `22`; `engines.node` = `>=22.12 <25`; `@types/node` starts `^22` |
| TC-002 | AC-002 | L1 | `tests/unit/repo/dependency-pins.test.ts` | `package.json` deps+devDeps | for each policy rule, check present packages | `@xyflow/react` `~12.12`; all `@liveblocks/*` equal and exact; prisma trio `~7.10`; vacuous pass when absent |
| TC-003 | AC-003 | L1 | `tests/unit/lib/env.test.ts` | `vi.resetModules()`, `vi.stubEnv` cleared of service keys | `await import('@/lib/env')` | no throw; `env.NODE_ENV === 'test'`; `env.LOG_LEVEL === 'info'`; service keys `undefined` |
| TC-004 | AC-004 | L1 | `tests/unit/lib/env.test.ts` | `vi.stubEnv('CLERK_SECRET_KEY', 'notaprefix')` | import | throws; message includes `CLERK_SECRET_KEY`, excludes `notaprefix` |
| TC-005 | AC-006 | L1 | `tests/unit/lib/env-public.test.ts` | read source text + import schema | regex per key | each key present as `process.env.KEY`; no `process.env[`; all keys `NEXT_PUBLIC_` |
| TC-006 | AC-007 | L1 | `tests/unit/repo/env-example.test.ts` | parse `.env.example` | compare key sets with both schemas | equal sets; no values; feature comment per key |
| TC-007 | AC-008 | L1 | `tests/unit/harness/rtl.test.tsx` | tiny inline component | `render`, `screen.getByRole`, `toBeInTheDocument` | passes under jsdom with jest-dom matchers |
| TC-008 | AC-009 | L3 | `tests/e2e/smoke.spec.ts` | app via `webServer` | `page.goto('/')`; `page.goto('/definitely-missing')` | 200; 404 with heading "Page not found" |
| TC-009 | AC-010 | L1 | `tests/unit/repo/playwright-config.test.ts` | `vi.stubEnv('E2E_LIVEBLOCKS', …)` + `vi.resetModules` | import `playwright.config.ts` | 1 vs 2 `webServer` entries; projects `setup`, `chromium` (deps `['setup']`) |
| TC-010 | AC-011 | L1 | `tests/unit/lint/rules.test.ts` | `new ESLint({ overrideConfigFile })` | `lintText` as `lib/x.ts` and `scripts/x.mjs` | `no-console` reported only for `lib/x.ts` |
| TC-011 | AC-012 | L1 | `tests/unit/lint/rules.test.ts` | same | `process.env.FOO` as `components/x.ts` vs `lib/env.ts` | reported vs not reported |
| TC-012 | AC-013 | L1 | `tests/unit/lint/rules.test.ts` | same | five banned exports as `app/x/page.tsx`; `export const metadata` | banned reported; `metadata` not |
| TC-013 | AC-013 | L1 | `tests/unit/repo/segment-config.test.ts` | glob `app/**/*.{ts,tsx}` | regex `export const (runtime\|dynamic\|revalidate\|fetchCache\|dynamicParams)\b` | zero matches |
| TC-014 | AC-014 | L1 | `tests/unit/lint/rules.test.ts` | same | `@/components/ui/button` import as `lib/foo.ts` vs `components/foo.tsx` | reported vs not |
| TC-015 | AC-015 | L1 | `tests/unit/scripts/check-prisma.test.ts` | temp dirs with/without `prisma/schema.prisma`; `PATH` emptied for the second case | `spawnSync('node', [script], { cwd })` | skip message + exit 0; "not installed" + exit 1 |
| TC-016 | AC-016 | L1 | `tests/unit/repo/ci-workflow.test.ts` | parse YAML | assert triggers, setup-node input, step order, sentinel env | all present in order |
| TC-017 | AC-017 | L1 | `tests/unit/lib/logger.test.ts` | spy `process.stdout.write` | `child({requestId}).info({...}, 'hello')` | one JSON line with expected fields |
| TC-018 | AC-018 | L1 | `tests/unit/lib/logger.test.ts` | `LOG_LEVEL=warn` via `vi.stubEnv` + reset modules; spies on stdout/stderr | `info` then `error` with string err and `token` key; `error` with `Error` | info silent; stderr line has `NonError`, `[redacted]`; Error has `stack` |
| TC-019 | AC-019 | L1 | `tests/unit/lib/errors.test.ts` | — | `httpStatusFor` each code; `ERROR_CODES.length` | mapping exact (incl. `INTERNAL` → 500); 8 |
| TC-020 | AC-020 | L1 | `tests/unit/lib/errors.test.ts` | — | construct `AppError`/`AccessError` variants | 422 allowed on VALIDATION only; `AccessError` fields and inheritance |
| TC-021 | AC-021 | L1 | `tests/unit/lib/errors.test.ts` | a `ZodError` from `z.object({a:z.string()}).safeParse({})` | `errorResponse` ×3 | 404 JSON; 400 with `fieldErrors.a`; plain `Error` rethrown |
| TC-022 | AC-022 | L1 | `tests/unit/lib/utils.test.ts` | — | `cn('p-2', { hidden: false }, 'p-4')` | `'p-4'` |
| TC-023 | AC-023 | L1 | `tests/unit/app/error.test.tsx` | error with `digest`; `retry` spy | render; click "Try again" | heading, reference text, no raw message, spy called once |
| TC-024 | AC-024 | L1 | `tests/unit/app/global-error.test.tsx` | — | call component function | `type === 'html'`; contains `body` |
| TC-025 | AC-025 | L1 | `tests/unit/app/not-found.test.tsx` | — | render | heading; link `href="/"` |
| TC-026 | AC-026 | L1 | `tests/unit/repo/readme.test.ts` | read README + package.json scripts | assertions | drawArc present; all scripts listed; context/features links; "Ghost AI" only with "former" |
| TC-027 | AC-028 | L1 | `tests/unit/scripts/check-bundle.test.ts` | temp `.next/static` tree; env with sentinel values; `cwd` temp | run script twice (clean tree; planted leak file) | exit 0 then exit 1 |
| TC-028 | AC-029 | L0 | `.github/workflows/ci.yml` | clean checkout in CI | `npm ci && npm run check && npm run build && npm run check:bundle && npm audit --audit-level=high` | all steps green; link to run recorded in status.md |
| TC-029 | AC-005 | Manual | — | throwaway `app/_probe/page.tsx` importing `@/lib/env` from a `'use client'` file | `npm run build` | build fails with the `server-only` error; output pasted to status.md; probe deleted |
| TC-030 | AC-027 | Manual | — | F00 branch vs base | `git diff --name-only`; `grep -n "cacheComponents\|partialPrefetching\|agentFeedback" next.config.ts` | protected files absent from the diff; three flags unchanged; recorded in status.md |

## Collaboration / concurrency cases

Not applicable — F00 touches no room, no database, and no shared state.

## AUTHZ-MATRIX

Not applicable — F00 adds no routes or Server Actions. The matrix format is first exercised by F02 (`POST /api/webhooks/clerk`, gated pages).

## Not tested automatically, and why

- `server-only` enforcement under Turbopack (TC-029): a build-time negative test would require committing a deliberately broken file; verified manually once per Next.js upgrade and backed by the automated sentinel check (TC-027/TC-028).
- Preservation of the owner's uncommitted edits (TC-030): a git-diff review, because the edits are not committed and cannot be snapshot in a test without committing them.
- `npm audit` outcomes: depend on the advisory database at run time; the CI step is the test, and EC-006 defines the exception path.
- `reuseExistingServer` behaviour and port clashes (EC-015): environment-specific; documented in README "Troubleshooting".
- Visual appearance of error pages: intentionally unstyled in F00; styled and checked in F01.
