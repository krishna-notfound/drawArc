# F00 — Design

## Architecture and components

F00 lives entirely in `lib/`, the repo root, `tests/`, `scripts/`, `.github/`, and three new files in `app/`. Dependency direction is unchanged (`app → components → lib → SDKs`); F00 adds the lint rule that enforces it.

| Path | New / modified | Responsibility |
|---|---|---|
| `.nvmrc` | new | `22` |
| `package.json` | modified | `engines`, scripts, devDependencies (below), `@types/node ^22` |
| `.env.example` | new | every env key, no values, activating feature in a comment |
| `lib/env.ts` | new | `import 'server-only'`; Zod server schema; `export const env`; `export { publicEnv }` |
| `lib/env.public.ts` | new | Zod client schema over literal `process.env.NEXT_PUBLIC_*` references; `export const publicEnv` |
| `lib/logger.ts` | new | JSON-line logger (server only; imports `env` for `LOG_LEVEL`) |
| `lib/errors.ts` | new | error codes, `AppError`, `AccessError`, `ActionResult`, `httpStatusFor`, `errorResponse` |
| `lib/utils.ts` | new | `cn()` (client-safe; imports nothing from `lib/env*`) |
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | new | baseline boundaries (F01 restyles) |
| `eslint.config.mjs` | modified | rules in FR-008 |
| `vitest.config.mts`, `tests/setup.ts` | new | L1 harness |
| `playwright.config.ts`, `tests/e2e/global.setup.ts`, `tests/e2e/smoke.spec.ts` | new | L3 harness |
| `scripts/check-prisma.mjs`, `scripts/check-bundle-secrets.mjs` | new | gate helpers (may use `console`) |
| `.github/workflows/ci.yml` | new | CI |
| `README.md` | rewritten | drawArc |
| `tsconfig.json` | unchanged | tests import from `vitest` explicitly (`globals: false`), so no `types` entry is needed; `**/*.mts` is already included |
| `.gitignore` | modified | add `/playwright-report/`, `/test-results/`, `/lib/generated/` |

Server vs client: `lib/env.ts` and `lib/logger.ts` are server-only. `lib/errors.ts` is isomorphic except `errorResponse`, which imports `next/server` (server-usable; importing the module from a client component is allowed but `errorResponse` is never called there). `lib/utils.ts` is isomorphic.

## Domain model and TypeScript contracts

```ts
// lib/env.public.ts
const publicRaw = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,   // F02 activates (required)
  NEXT_PUBLIC_LIVEBLOCKS_BASE_URL: process.env.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL,       // tests only (F05)
};
export const PublicEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  NEXT_PUBLIC_LIVEBLOCKS_BASE_URL: z.string().url().optional(),
});
export type PublicEnv = z.infer<typeof PublicEnvSchema>;
export const publicEnv: PublicEnv = parseOrThrow(PublicEnvSchema, publicRaw, 'public');

// lib/env.ts
import 'server-only';
export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),            // default derived: debug in development, info otherwise
  DATABASE_URL: z.string().url().optional(),                                     // F02 activates
  DATABASE_URL_UNPOOLED: z.string().url().optional(),                            // F02 activates
  DATABASE_URL_TEST: z.string().url().optional(),                                // L2 only
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),                     // F02 activates
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().startsWith('whsec_').optional(),      // F02 activates
  LIVEBLOCKS_SECRET_KEY: z.string().startsWith('sk_').optional(),                // F05 activates
  LIVEBLOCKS_WEBHOOK_SECRET_KEY: z.string().startsWith('whsec_').optional(),     // F05 activates (webhook route is F05's)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),                                  // F13, local/CI only (OIDC on Vercel)
  TRIGGER_SECRET_KEY: z.string().optional(),                                     // M2 (F17)
});
export type ServerEnv = z.infer<typeof ServerEnvSchema> & { LOG_LEVEL: LogLevel };
export const env: ServerEnv;
export { publicEnv } from './env.public';
// parseOrThrow: on failure -> new Error(`Invalid environment (${scope}): KEY (issue_code), ...`)  — never includes values
```

```ts
// lib/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext { requestId?: string; userId?: string; projectId?: string; runId?: string; err?: unknown; [key: string]: unknown }
export interface Logger {
  debug(ctx: LogContext, msg: string): void; info(...): void; warn(...): void; error(...): void;
  child(bindings: LogContext): Logger;
}
export const logger: Logger;
// line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...bindings, ...ctx, err: serializeError(ctx.err) })
// debug/info -> process.stdout.write; warn/error -> process.stderr.write; redacts keys /password|token|secret|authorization/i
```

```ts
// lib/errors.ts
export const ERROR_CODES = ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'CONFLICT', 'RATE_LIMITED', 'UPSTREAM', 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export const HTTP_STATUS_BY_CODE: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502> =
  { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409, RATE_LIMITED: 429, UPSTREAM: 502, INTERNAL: 500 };
export function httpStatusFor(code: ErrorCode): number;
export class AppError extends Error {
  readonly code: ErrorCode; readonly status: number; readonly details?: unknown;
  constructor(code: ErrorCode, message?: string, opts?: { status?: 422; details?: unknown; cause?: unknown });  // status override only valid with 'VALIDATION'
}
export class AccessError extends AppError {   // thrown by requireUser (F02) and requireProjectRole (F03)
  constructor(code: Extract<ErrorCode, 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND'>, public readonly reason?: string);
}
export interface ActionError { code: ErrorCode; message: string; reason?: string; fieldErrors?: Record<string, string[]> }
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
export function errorResponse(err: unknown): NextResponse;   // AppError | ZodError -> JSON body; else rethrow
export function isAppError(err: unknown): err is AppError;
```

`lib/utils.ts`: `export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)); }`

## Data and state ownership

F00 stores nothing. Configuration ownership follows data-ownership.md: Vercel project env is authoritative (F15); `.env.local` is the dev copy; `lib/env.ts` is the only reader. Logs go to stdout → Vercel runtime logs (D-019 open; no SaaS).

## API and integration contracts

No routes, actions, events, or tasks. Scripts (contract with contributors and CI):

| Script | Command | Exit code semantics |
|---|---|---|
| `typecheck` | `next typegen && tsc --noEmit` | non-zero on any type error (typegen first: route types live in `.next/types`) |
| `lint` | `eslint .` | non-zero on any error |
| `test` | `vitest run` | non-zero on any failure; `--passWithNoTests` is not set because F00 ships tests |
| `check` | `next typegen && tsc --noEmit && eslint . && vitest run && node scripts/check-prisma.mjs` | first failure stops |
| `check:bundle` | `node scripts/check-bundle-secrets.mjs` | 1 if any sentinel string is found under `.next/static/**`; 1 with "run build first" if `.next/static` is missing; 0 otherwise |
| `e2e` | `playwright test` | Playwright exit code |
| `e2e:install` | `playwright install --with-deps chromium` | — |

`scripts/check-bundle-secrets.mjs` reads the server key names from a static list mirrored from `ServerEnvSchema` (it cannot import `server-only` code); for each key whose value contains `SENTINEL`, it searches `.next/static` recursively for that value. CI sets e.g. `CLERK_SECRET_KEY=sk_SENTINEL_clerk`, `DATABASE_URL=postgresql://SENTINEL@localhost/db`.

Playwright config shape (contract for F02/F05):

```ts
export default defineConfig({
  testDir: 'tests/e2e', fullyParallel: true, retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  webServer: [
    { command: process.env.CI ? 'npm run start' : 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 },
    ...(process.env.E2E_LIVEBLOCKS === '1'
      ? [{ command: 'npx liveblocks dev --no-persist --no-check --port 1153', url: 'http://localhost:1153', reuseExistingServer: !process.env.CI }]
      : []),
  ],
});
```

`tests/e2e/global.setup.ts` in F00 is `setup('bootstrap', async () => { /* F02 adds clerkSetup() */ })`.

## Security and validation

- Threat: secret leakage to the client bundle. Controls: `server-only` import (build-time), `lib/env.public.ts` whitelist, lint ban on `process.env` elsewhere, CI sentinel grep (FR-017).
- Threat: secrets in logs. Control: logger redaction of sensitive key names (EC-009); env error messages contain key names only.
- Threat: expected errors leaking stack traces. Control: `errorResponse` emits only `{ code, message, fieldErrors? }`; unexpected errors are rethrown to Next, which hides details in production.
- Threat: supply chain. Controls: pins (FR-002), `npm ci` from lockfile, `npm audit --audit-level=high` (FR-010).
- No rate limits (no endpoints).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Vitest 5.0.5 requires Node ≥ 22.12 and Vite ≥ 6.4 (peer `vite ^6.4 \|\| ^7 \|\| ^8`, `@types/node ^22 \|\| >=24`); `clearMocks` default true | https://vitest.dev/guide/migration ; https://registry.npmjs.org/vitest/latest | 2026-10-22 |
| `@vitejs/plugin-react` 6.1.2 requires Vite 8 (peer `vite ^8.0.0`) | https://registry.npmjs.org/@vitejs/plugin-react/latest | 2026-10-22 |
| `@testing-library/react` 16.3.3 supports React 19 (peer `react ^18 \|\| ^19`) | https://registry.npmjs.org/@testing-library/react/latest | 2026-10-22 |
| Next Vitest guide: `vitest.config.mts` with `tsconfigPaths()` + `react()` + `environment: 'jsdom'`; async Server Components are not unit-testable | `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` | 2026-10-22 |
| `@playwright/test` 1.64.1, Node ≥ 20; `@next/playwright` 16.4.2 `instant()` requires Cache Components (experimental) | https://registry.npmjs.org/@playwright/test/latest ; `01-app/02-guides/testing/playwright.md` | 2026-10-22 |
| Under `cacheComponents`, `runtime`, `dynamic`, `revalidate`, `fetchCache`, `dynamicParams` exports must be removed; `partialPrefetching` must be set explicitly | `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`; `02-guides/migrating-to-cache-components.md` | 2026-10-22 |
| `error.tsx` props `{ error, retry }` (`retry` stable 16.3); `global-error.tsx` renders own `<html>/<body>` | `01-app/03-api-reference/03-file-conventions/error.md`; `01-getting-started/10-error-handling.md` | 2026-10-22 |
| `experimental.agentFeedback` manages a block in `AGENTS.md` during `next dev`; does not run in CI | `01-app/03-api-reference/05-config/01-next-config-js/agentFeedback.md` | 2026-10-22 |
| `next lint` removed in 16; ESLint flat config is the supported path | `01-app/02-guides/upgrading/version-16.md` | 2026-10-22 |
| Liveblocks Playwright guide: `npx liveblocks dev --no-persist --no-check`, port 1153, `pk_localdev` | https://liveblocks.io/docs/guides/how-to-set-up-end-to-end-e2e-testing-with-playwright | 2026-10-22 |
| UNVERIFIED: current versions of `zod`, `jsdom`, `vite-tsconfig-paths`, `@testing-library/jest-dom`, `clsx`, `tailwind-merge`; `server-only` behaviour with Turbopack in 16.4 (expected: build error on client import). Fallback: T-001 records installed versions in status.md; if `server-only` does not error under Turbopack, the sentinel check (FR-017) remains the enforced control. | — | — |
| UNVERIFIED: ESLint selector `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^(runtime\|dynamic\|revalidate\|fetchCache\|dynamicParams)$/]` matches `export const dynamic = ...` under `@typescript-eslint/parser`. Fallback: a unit test greps `app/**` for the same exports (TC-013 keeps both). | — | — |

**Resolved at Gate 4 (D-036):** `code-standards.md` "Logging and errors" now closes `ErrorCode` at eight codes (incl. `INTERNAL` 500) with `VALIDATION → 400` by default and 422 only when the caller passes `{ status: 422 }` for semantic/limit violations; `architecture-context.md` "Error handling" and `security-model.md` "Snapshot and artifact access" use the same rule. D-F00-4 implements exactly that; no `UNPROCESSABLE` code is added. Non-member reads use `FORBIDDEN` (403) with the same body as a missing project.
