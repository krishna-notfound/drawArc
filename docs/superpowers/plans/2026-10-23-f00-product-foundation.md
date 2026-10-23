# F00 Product Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bare Next.js 16 scaffold into a repository that can prove its own correctness: pinned toolchain, validated env boundary, L0–L3 test harness, rule-enforcing lint, shared server utilities, baseline error boundaries, and a CI quality gate.

**Architecture:** Everything lands in `lib/`, `tests/`, `scripts/`, `.github/`, the repo root, and three new `app/` boundary files. No product library (Clerk, Prisma, Liveblocks, React Flow) and no external service is touched. Every spec task T-001…T-012 maps 1:1 to a plan task below.

**Tech Stack:** Next.js 16.4.2 (Cache Components), React 19.3, TypeScript 5.9 strict, Zod 4, Vitest 5 + Vite 8 + Testing Library 16 + jsdom 30, Playwright 1.64 + `@next/playwright` 16.4.2, ESLint 9 flat config (`eslint-config-next` 16.4.2, `eslint-plugin-import` 2.32 via it), GitHub Actions.

**Spec:** `features/00-product-foundation/` (00–05, approved 2026-10-23). Read `02-design.md` for contracts and `03-acceptance-criteria.md` for the exact assertions; this plan cites them as `AC-0NN`.

## Global Constraints

- Node: `.nvmrc` = `22`; `engines.node` = `>=22.12 <25` (local machine is v24.21.0 — accepted by the range; CI uses 22).
- `@types/node` `^22`. All F00 dependencies use caret ranges except `@next/playwright` which is exact `16.4.2` (matches `next`).
- Resolved versions on 2026-10-23 (record in `status.md` at the end): zod 4.6.7, clsx 2.1.1, tailwind-merge 3.7.0, server-only 0.0.1, vitest 5.0.5, vite 8.3.5, @vitejs/plugin-react 6.1.2, vite-tsconfig-paths 6.1.1, jsdom 30.1.3, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @playwright/test 1.64.1, yaml 2.9.1.
- Do **not** modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `AGENTS.md`, `next.config.ts`, `No_touch_ai/**`. Do not stage the owner's pre-existing staged deletions `public/*.svg` (FR-016).
- No `export const runtime|dynamic|revalidate|fetchCache|dynamicParams` anywhere under `app/` (Cache Components).
- No `console.*` outside `scripts/**`; no `process.env` outside the allow-list in FR-008.
- Error codes and HTTP mapping exactly: `UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404, VALIDATION 400 (422 override only), CONFLICT 409, RATE_LIMITED 429, UPSTREAM 502, INTERNAL 500` (D-036).
- UI copy exactly: error page "Something went wrong" / "Reference: {digest}" / "Try again"; global error "drawArc could not load" / "Reload"; not-found "Page not found" / "Go to drawArc home".
- Tests that need Node APIs (fs, child_process, ESLint API, YAML, Playwright config) start with `// @vitest-environment node`. jsdom is the default environment.
- One commit for the whole phase, after verification, author `krishna <krishnagtkr@gmail.com>`, committed by explicit pathspec (Task 12). No push.

## Review Focus

1. **`server-only` under Vitest.** Importing `lib/env.ts` or `lib/logger.ts` in a test must not throw "cannot be imported from a Client Component". Expected: Vitest aliases `server-only` to an empty stub; `next build` still enforces the real package. Pinned by the env/logger tests in Tasks 3 and 5 importing the real modules.
2. **Flat-config rule replacement.** A later config block that sets `no-restricted-syntax` for `app/**` replaces the global one, which would silently re-allow `process.env` in `app/`. Expected: `process.env.FOO` in `app/x/page.tsx` is still an error. Pinned by an extra case in Task 6.
3. **Empty-string env values.** A `.env.local` line like `CLERK_SECRET_KEY=` yields `''`, which fails `startsWith('sk_')` and would crash boot even though the key is "unset". Expected: empty strings are treated as undefined. Pinned in Task 3.
4. **CRLF line endings on Windows.** `.nvmrc` and `.env.example` may be checked out with `\r\n`. Expected: tests split on `/\r?\n/` and trim, so they pass on Windows and Linux CI alike. Pinned in Tasks 1 and 3.
5. **Commit isolation.** The working tree contains the owner's uncommitted edits (`app/*`, and a `/features/curr` line in `.gitignore`), staged `public/*.svg` deletions, and uncommitted planning docs. Expected: the F00 commit contains only F00 files and only F00's lines of `.gitignore`. Pinned by the AC-027 manual record and the pathspec + partial-staging commit in Task 12.

---

### Task 1: Toolchain, dependencies, scripts (spec T-001)

**Files:**
- Create: `.nvmrc`
- Modify: `package.json`, `package-lock.json`, `.gitignore`
- Test: `tests/unit/repo/toolchain.test.ts`, `tests/unit/repo/dependency-pins.test.ts`

**Interfaces:**
- Produces: npm scripts `typecheck`, `lint`, `test`, `test:watch`, `check`, `check:bundle`, `e2e`, `e2e:install` (used by every later task and CI).

- [ ] **Step 1: Install dependencies**

```bash
npm i zod@^4 clsx@^2 tailwind-merge@^3 server-only@^0.0.1
npm i -D @types/node@^22 vitest@^5.0.5 vite@^8 @vitejs/plugin-react@^6.1.2 vite-tsconfig-paths@^6 jsdom@^30 @testing-library/react@^16.3.3 @testing-library/dom@^10 @testing-library/jest-dom@^7 @playwright/test@^1.64.1 yaml@^2
npm i -D --save-exact @next/playwright@16.4.2
```

Expected: exit 0. If npm warns about install scripts (e.g. esbuild), note it; do not change global npm config.

- [ ] **Step 2: Edit `package.json`** — add `"engines": { "node": ">=22.12 <25" }` and scripts:

```json
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"test": "vitest run",
"test:watch": "vitest",
"check": "tsc --noEmit && eslint . && vitest run && node scripts/check-prisma.mjs",
"check:bundle": "node scripts/check-bundle-secrets.mjs",
"e2e": "playwright test",
"e2e:install": "playwright install --with-deps chromium"
```

Keep `dev`, `build`, `start`. Create `.nvmrc` containing `22`. Append to `.gitignore`: `/playwright-report/`, `/test-results/`, `/lib/generated/`, `/blob-report/`.

- [ ] **Step 3: Write tests** `tests/unit/repo/toolchain.test.ts` (AC-001) and `tests/unit/repo/dependency-pins.test.ts` (AC-002), both `// @vitest-environment node`:

```ts
// toolchain.test.ts
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
it('pins Node 22', () => {
  expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('22');
  expect(pkg.engines.node).toBe('>=22.12 <25');
  expect(pkg.devDependencies['@types/node']).toMatch(/^\^22/);
});

// dependency-pins.test.ts
const all = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
it('@xyflow/react is ~12.12 when present', () => { if (all['@xyflow/react']) expect(all['@xyflow/react']).toMatch(/^~12\.12/); });
it('all @liveblocks/* share one exact version', () => {
  const v = Object.entries(all).filter(([n]) => n.startsWith('@liveblocks/')).map(([, r]) => r);
  v.forEach((r) => expect(r).not.toMatch(/[\^~]/));
  expect(new Set(v).size).toBeLessThanOrEqual(1);
});
it('prisma trio is ~7.10 when present', () => {
  for (const n of ['prisma', '@prisma/client', '@prisma/adapter-neon']) if (all[n]) expect(all[n]).toMatch(/^~7\.10/);
});
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/repo/toolchain.test.ts tests/unit/repo/dependency-pins.test.ts` → PASS (Vitest defaults suffice; config comes in Task 2). Run `npm run typecheck` → PASS.

---

### Task 2: Vitest harness (spec T-002)

**Files:**
- Create: `vitest.config.mts`, `tests/setup.ts`, `tests/stubs/server-only.ts`, `tests/unit/harness/rtl.test.tsx`

**Interfaces:**
- Produces: `@/*` path alias in tests; `server-only` stub; jest-dom matchers; jsdom default env.

- [ ] **Step 1: Write the failing test** `tests/unit/harness/rtl.test.tsx` (AC-008):

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
it('renders with jest-dom matchers under jsdom', () => {
  render(<button type="button">Hello</button>);
  expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/harness` → FAIL (`toBeInTheDocument` is not a function / JSX transform missing).

- [ ] **Step 3: Create `vitest.config.mts`**

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts', '{app,components,lib,hooks}/**/*.test.{ts,tsx}'],
  },
});
```

`tests/stubs/server-only.ts`: `export {};` with a one-line comment saying why (Review Focus 1). `tests/setup.ts`: `import '@testing-library/jest-dom/vitest';` and `afterEach(cleanup)` from RTL. If jest-dom 7 moved the Vitest entry point, use the path its README documents and note it in status.md.

- [ ] **Step 4: Run** `npm run test` → PASS (3 files). Confirm `tests/e2e/**` is not collected.

---

### Task 3: Environment boundary (spec T-003)

**Files:**
- Create: `lib/env.public.ts`, `lib/env.ts`, `.env.example`
- Test: `tests/unit/lib/env.test.ts`, `tests/unit/lib/env-public.test.ts`, `tests/unit/repo/env-example.test.ts`

**Interfaces:**
- Produces: `env: ServerEnv` and `publicEnv: PublicEnv` (from `@/lib/env`), `PublicEnvSchema`, `ServerEnvSchema`, `parseEnv<T>(schema, raw, scope): T` (exported from `lib/env.public.ts`, client-safe), `type LogLevel = 'debug'|'info'|'warn'|'error'` (exported from `lib/env.ts`; Task 5 imports it).
- Schema contents: exactly the key list in `02-design.md` "Domain model and TypeScript contracts".

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/lib/env.test.ts — // @vitest-environment node
const SERVICE_KEYS = ['DATABASE_URL','DATABASE_URL_UNPOOLED','DATABASE_URL_TEST','CLERK_SECRET_KEY','CLERK_WEBHOOK_SIGNING_SECRET','LIVEBLOCKS_SECRET_KEY','LIVEBLOCKS_WEBHOOK_SECRET_KEY','BLOB_READ_WRITE_TOKEN','TRIGGER_SECRET_KEY'];
beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); SERVICE_KEYS.forEach((k) => vi.stubEnv(k, undefined)); vi.stubEnv('LOG_LEVEL', undefined); });
it('loads with no service keys (AC-003)', async () => {
  const { env } = await import('@/lib/env');
  expect(env.NODE_ENV).toBe('test'); expect(env.LOG_LEVEL).toBe('info');
  SERVICE_KEYS.forEach((k) => expect(env[k as keyof typeof env]).toBeUndefined());
});
it('rejects a malformed key without leaking its value (AC-004)', async () => {
  vi.stubEnv('CLERK_SECRET_KEY', 'notaprefix');
  await expect(import('@/lib/env')).rejects.toThrow(/CLERK_SECRET_KEY/);
  await import('@/lib/env').catch((e: Error) => expect(e.message).not.toContain('notaprefix'));
});
it('treats empty strings as unset (Review Focus 3)', async () => {
  vi.stubEnv('CLERK_SECRET_KEY', '');
  const { env } = await import('@/lib/env');
  expect(env.CLERK_SECRET_KEY).toBeUndefined();
});

// tests/unit/lib/env-public.test.ts — AC-006: read source text of lib/env.public.ts;
// for every key of PublicEnvSchema.shape: expect(src).toContain(`process.env.${key}`), key starts with 'NEXT_PUBLIC_';
// expect(src).not.toContain('process.env[').

// tests/unit/repo/env-example.test.ts — AC-007, split on /\r?\n/:
// lines match /^(#.*|[A-Z0-9_]+=)?$/ (blank allowed); every schema key (server ∪ public) appears;
// extra keys allowed only if they match /^(E2E_[A-Z0-9_]+|CI)$/; each key line is preceded by a comment line matching /F0|F1|M2|tests/.
```

Spec note: AC-007 says "key sets are equal", but `04-implementation-plan.md` also requires the E2E-only keys in `.env.example` without putting them in the schema. The test resolves that contradiction by allowing only those extras. Record this in status.md.

- [ ] **Step 2: Run** `npx vitest run tests/unit/lib/env tests/unit/repo/env-example.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement**
  - `lib/env.public.ts`: `publicRaw` built from literal `process.env.NEXT_PUBLIC_*` references; `PublicEnvSchema`; `parseEnv(schema, raw, scope)` maps `''` to `undefined`, runs `safeParse`, and on failure throws `new Error(\`Invalid environment (${scope}): ${issues.map(i => \`${i.path.join('.')} (${i.code})\`).join(', ')}\`)` (key names and Zod issue codes only); `export const publicEnv = parseEnv(PublicEnvSchema, publicRaw, 'public')`.
  - `lib/env.ts`: `import 'server-only'`; `ServerEnvSchema` per design; parse `process.env`; derive `LOG_LEVEL` (`debug` when `NODE_ENV === 'development'`, else `info`) when unset; `export const env`; `export { publicEnv } from './env.public'`; `export type LogLevel`.
  - `.env.example`: every key with an activation comment (`# F02 activates`, `# F05 activates`, `# F13 (local/CI only)`, `# M2 (F17)`, `# tests only (F05)`, `# L2 tests only`), no values; then a block of E2E keys `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`, `E2E_LIVEBLOCKS`, each with a `# tests only` comment. Do not list `CI` as an assignment line (CI sets it).

- [ ] **Step 4: Run** the same tests → PASS.

---

### Task 4: Errors and `cn()` (spec T-004)

**Files:**
- Create: `lib/errors.ts`, `lib/utils.ts`
- Test: `tests/unit/lib/errors.test.ts` (`// @vitest-environment node`), `tests/unit/lib/utils.test.ts`

**Interfaces:**
- Produces (exact names, consumed by F02/F03/F05/F13/F15): `ERROR_CODES`, `ErrorCode`, `HTTP_STATUS_BY_CODE`, `httpStatusFor(code): number`, `class AppError(code, message?, opts?: { status?: 422; details?; cause? })`, `class AccessError(code: 'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND', reason?)`, `interface ActionError`, `type ActionResult<T>`, `isAppError(err)`, `errorResponse(err): NextResponse`; `cn(...inputs: ClassValue[]): string`.

- [ ] **Step 1: Write failing tests** — AC-019 to AC-022 verbatim:

```ts
it('maps codes (AC-019)', () => {
  expect(ERROR_CODES).toHaveLength(8);
  expect(ERROR_CODES.map(httpStatusFor)).toEqual([401, 403, 404, 400, 409, 429, 502, 500]);
});
it('allows 422 only on VALIDATION (AC-020)', () => {
  expect(new AppError('VALIDATION', 'too big', { status: 422 }).status).toBe(422);
  expect(() => new AppError('CONFLICT', 'x', { status: 422 })).toThrow();
  const a = new AccessError('FORBIDDEN', 'not-a-member');
  expect([a.status, a.code, a.reason, a instanceof AppError]).toEqual([403, 'FORBIDDEN', 'not-a-member', true]);
});
it('builds responses (AC-021)', async () => {
  const r1 = errorResponse(new AppError('NOT_FOUND'));
  expect(r1.status).toBe(404); expect((await r1.json()).error.code).toBe('NOT_FOUND');
  const zr = z.object({ a: z.string() }).safeParse({});
  const r2 = errorResponse(zr.error);
  expect(r2.status).toBe(400); expect((await r2.json()).error.fieldErrors.a).toBeDefined();
  expect(() => errorResponse(new Error('x'))).toThrow('x');
});
// utils.test.ts (AC-022)
it('merges classes', () => expect(cn('p-2', { hidden: false }, 'p-4')).toBe('p-4'));
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** to the contracts in `02-design.md` (ZodError → `VALIDATION` 400, `fieldErrors` from `z.flattenError(err).fieldErrors` (Zod 4 API — confirm in the installed version), message "Invalid input"). **Step 4: Run** → PASS.

---

### Task 5: Logger (spec T-005)

**Files:**
- Create: `lib/logger.ts`
- Test: `tests/unit/lib/logger.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes: `env.LOG_LEVEL`, `LogLevel` from `@/lib/env` (Task 3).
- Produces: `logger: Logger` with `debug|info|warn|error(ctx: LogContext, msg: string)` and `child(bindings): Logger`; `LogContext` per design.

- [ ] **Step 1: Write failing tests** (AC-017, AC-018; reset modules and stub `LOG_LEVEL` before each dynamic import):

```ts
it('writes one JSON line with bindings (AC-017)', async () => {
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const { logger } = await import('@/lib/logger');
  logger.child({ requestId: 'r1' }).info({ userId: 'u1', projectId: 'p1' }, 'hello');
  expect(out).toHaveBeenCalledTimes(1);
  const line = JSON.parse(String(out.mock.calls[0][0]));
  expect(line).toMatchObject({ level: 'info', msg: 'hello', requestId: 'r1', userId: 'u1', projectId: 'p1' });
  expect(new Date(line.time).toISOString()).toBe(line.time);
});
it('filters, redacts, serialises (AC-018)', async () => {
  vi.stubEnv('LOG_LEVEL', 'warn');
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const { logger } = await import('@/lib/logger');
  logger.info({}, 'quiet'); expect(out).not.toHaveBeenCalled();
  logger.error({ err: 'boom', token: 'abc' }, 'x');
  const l = JSON.parse(String(err.mock.calls[0][0]));
  expect(l.err).toEqual({ name: 'NonError', message: 'boom' }); expect(l.token).toBe('[redacted]');
  logger.error({ err: new Error('e') }, 'y');
  expect(JSON.parse(String(err.mock.calls[1][0])).err.stack).toBeDefined();
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: level order `debug<info<warn<error`; redact keys matching `/password|token|secret|authorization/i` (top level of ctx and bindings); `err` serialised as `{ name, message, stack }` for `Error`, else `{ name: 'NonError', message: String(err) }`; write `JSON.stringify(line) + '\n'`. **Step 4: Run** → PASS.

---

### Task 6: ESLint rules (spec T-006)

**Files:**
- Modify: `eslint.config.mjs`
- Test: `tests/unit/lint/rules.test.ts`, `tests/unit/repo/segment-config.test.ts` (both `// @vitest-environment node`)

**Interfaces:**
- Produces: lint enforcement relied on by every later feature's review.

- [ ] **Step 1: Write failing tests** using `const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' })` and a helper `ruleIds(code, filePath) => (await eslint.lintText(code, { filePath }))[0].messages.map(m => m.ruleId)`:

| Case | filePath | Expect |
|---|---|---|
| `console.log('x')` | `lib/x.ts` / `scripts/x.mjs` | contains `no-console` / not (AC-011) |
| `export const x = process.env.FOO;` | `components/x.ts` / `lib/env.ts` | contains `no-restricted-syntax` / not (AC-012) |
| `export const x = process.env.FOO;` | `app/x/page.tsx` | contains `no-restricted-syntax` (Review Focus 2) |
| `const k = 'A'; export const x = process.env[k];` | `lib/env.public.ts` | contains `no-restricted-syntax` (EC-003) |
| `export const dynamic = 'force-dynamic';` and same for `runtime`, `revalidate`, `fetchCache`, `dynamicParams` | `app/x/page.tsx` | contains `no-restricted-syntax` (AC-013) |
| `export const metadata = {};` | `app/x/page.tsx` | no `no-restricted-syntax` |
| `import { x } from '@/components/ui/button'; export default x;` | `lib/foo.ts` / `components/foo.tsx` | contains `no-restricted-imports` / not (AC-014) |

`segment-config.test.ts`: recursively read `app/**/*.{ts,tsx}`; regex `/export const (runtime|dynamic|revalidate|fetchCache|dynamicParams)\b/` → zero matches (AC-013).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `eslint.config.mjs`** — keep the existing `nextVitals`, `nextTs` and ignores, then append blocks in this order (later blocks override earlier ones for matching files; each `no-restricted-syntax` value must list every selector that applies to those files):

```js
const PROCESS_ENV = { selector: "MemberExpression[object.name='process'][property.name='env']", message: 'Read env only via lib/env.ts or lib/env.public.ts.' };
const SEGMENT_EXPORTS = ['runtime','dynamic','revalidate','fetchCache','dynamicParams'].map((n) => ({
  selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='${n}']`,
  message: `\`export const ${n}\` is incompatible with cacheComponents.`,
}));
const COMPUTED_ENV = { selector: "MemberExpression[computed=true][object.type='MemberExpression'][object.object.name='process'][object.property.name='env']", message: 'Use literal process.env.NEXT_PUBLIC_X so Next can inline it.' };
// 1. all files: no-console error; @typescript-eslint/no-explicit-any error; @typescript-eslint/consistent-type-imports error;
//    import/order error with groups [builtin, external, internal, [parent, sibling, index]], pathGroups [{ pattern: '@/**', group: 'internal' }];
//    no-restricted-syntax: ['error', PROCESS_ENV]
// 2. files app/**: no-restricted-syntax: ['error', PROCESS_ENV, ...SEGMENT_EXPORTS]
// 3. files lib/**, trigger/**: no-restricted-imports: ['error', { patterns: [{ group: ['@/app/*', '@/components/*', '@/hooks/*'], message: 'lib/ and trigger/ must not import UI layers.' }] }]
// 4. allow-list files (lib/env.ts, next.config.ts, vitest.config.mts, playwright.config.ts, prisma.config.ts, scripts/**, tests/setup.ts, tests/e2e/**): no-restricted-syntax off
// 5. lib/env.public.ts: no-restricted-syntax: ['error', COMPUTED_ENV]
// 6. scripts/**: no-console off
// globalIgnores add: playwright-report/**, test-results/**, blob-report/**, coverage/**, lib/generated/**
```

If the `import` plugin is not resolvable from this block, add `eslint-plugin-import` as an explicit dev dependency (spec allows it) and record it.

- [ ] **Step 4: Run** `npx vitest run tests/unit/lint tests/unit/repo/segment-config.test.ts` → PASS. Then `npm run lint` on the whole repo → PASS. If a new rule flags the owner's `app/page.tsx` or `app/layout.tsx`, **do not edit them**: add a file-scoped override for that rule only and report it (spec note).

---

### Task 7: Baseline error boundaries (spec T-007)

**Files:**
- Create: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
- Test: `tests/unit/app/error.test.tsx`, `tests/unit/app/global-error.test.tsx`, `tests/unit/app/not-found.test.tsx`

**Interfaces:**
- Produces: boundaries F01 restyles (semantic HTML only now; no colour classes).

- [ ] **Step 1: Write failing tests** (AC-023/024/025):

```tsx
it('error.tsx shows digest, hides message, retries', async () => {
  const retry = vi.fn();
  render(<ErrorPage error={Object.assign(new Error('secret detail'), { digest: 'abc123' })} retry={retry} />);
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
  expect(screen.queryByText(/secret detail/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' })); // or fireEvent.click if user-event is not installed
  expect(retry).toHaveBeenCalledTimes(1);
});
it('global-error renders its own html/body', () => {
  const el = GlobalError({ error: new Error('x'), retry: () => {} });
  expect(el.type).toBe('html');
  expect(Children.toArray(el.props.children).some((c) => isValidElement(c) && c.type === 'body')).toBe(true);
});
it('not-found has heading and home link', () => {
  render(<NotFound />);
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to drawArc home' })).toHaveAttribute('href', '/');
});
```

Use `fireEvent` from RTL unless `@testing-library/user-event` is added (it is not in the spec's dependency list — prefer `fireEvent`).

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with the exact copy from Global Constraints. Before writing, read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` and use its documented prop types for `error`/`retry`. `not-found.tsx` uses `next/link`; if rendering `Link` in jsdom throws for lack of an app router context, mock `next/link` in that test as a plain anchor (do not change the component). No segment-config exports. **Step 4: Run** → PASS.

---

### Task 8: Gate scripts (spec T-008)

**Files:**
- Create: `scripts/check-prisma.mjs`, `scripts/check-bundle-secrets.mjs`
- Test: `tests/unit/scripts/check-prisma.test.ts`, `tests/unit/scripts/check-bundle.test.ts` (both `// @vitest-environment node`)

**Interfaces:**
- Produces: `check-bundle-secrets.mjs` exports `SERVER_KEYS: string[]` and runs `main()` only when executed directly (`import.meta.url === pathToFileURL(process.argv[1]).href`).

- [ ] **Step 1: Write failing tests**

```ts
// check-prisma.test.ts (AC-015) — run with spawnSync(process.execPath, [abs(script)], { cwd: tmp, encoding: 'utf8' })
it('skips without a schema', () => { const r = run(emptyTmp); expect(r.status).toBe(0); expect(r.stdout).toContain('prisma validate: skipped (no schema yet)'); });
it('fails when schema exists but prisma is not installed', () => {
  const r = run(tmpWith('prisma/schema.prisma'));
  expect(r.status).toBe(1); expect(r.stdout + r.stderr).toContain('prisma validate: schema present but prisma is not installed');
});
// check-bundle.test.ts (AC-028) — tmp dir with .next/static/chunks/a.js = 'ok'; env { ...process.env, CLERK_SECRET_KEY: 'sk_SENTINEL_x' }
it('passes on a clean tree, fails on a planted leak', () => { /* run → 0; write leak.js containing sk_SENTINEL_x; run → 1 */ });
it('fails with "run build first" when .next/static is missing', () => { /* status 1, message */ });
it('SERVER_KEYS mirrors ServerEnvSchema', async () => {
  const { SERVER_KEYS } = await import('../../../scripts/check-bundle-secrets.mjs');
  const { ServerEnvSchema } = await import('@/lib/env');
  expect([...SERVER_KEYS].sort()).toEqual(Object.keys(ServerEnvSchema.shape).filter((k) => !['NODE_ENV', 'LOG_LEVEL'].includes(k)).sort());
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**
  - `check-prisma.mjs`: if `prisma/schema.prisma` (relative to `process.cwd()`) is missing → print the skip line, exit 0. Else resolve `prisma/package.json` with `createRequire(join(process.cwd(), 'noop.js'))`; on failure print the "not installed" line, exit 1; on success `spawnSync('npx', ['prisma', 'validate'], { stdio: 'inherit', shell: true })` and exit with its status.
  - `check-bundle-secrets.mjs`: collect values of `SERVER_KEYS` whose env value contains `SENTINEL`; missing `.next/static` → `check:bundle: .next/static not found — run build first`, exit 1; recursively scan files (utf8) for any sentinel value; print each hit as `path: KEY` (never the value) and exit 1, else exit 0. If no sentinel values are set, print `check:bundle: no sentinel values set; nothing to check` and exit 0.
- [ ] **Step 4: Run** tests → PASS. Then `npm run check` → all four stages pass (prisma stage prints the skip line).

---

### Task 9: Playwright scaffold (spec T-009)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global.setup.ts`, `tests/e2e/smoke.spec.ts`
- Test: `tests/unit/repo/playwright-config.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Produces (contract for F02/F05): projects `setup` (matches `global.setup.ts`) and `chromium` (`dependencies: ['setup']`); `webServer` array, second entry only when `E2E_LIVEBLOCKS === '1'`; `baseURL` `http://localhost:3000`.

- [ ] **Step 1: Write failing tests**

```ts
// playwright-config.test.ts (AC-010)
beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); });
it('one webServer by default', async () => {
  vi.stubEnv('E2E_LIVEBLOCKS', undefined);
  const cfg = (await import('../../../playwright.config')).default;
  expect(cfg.webServer).toHaveLength(1);
  expect(cfg.projects?.map((p) => p.name)).toEqual(['setup', 'chromium']);
  expect(cfg.projects?.[1].dependencies).toEqual(['setup']);
});
it('adds the Liveblocks dev server when E2E_LIVEBLOCKS=1', async () => {
  vi.stubEnv('E2E_LIVEBLOCKS', '1');
  const cfg = (await import('../../../playwright.config')).default;
  expect(cfg.webServer).toHaveLength(2);
  expect((cfg.webServer as { url: string }[])[1].url).toBe('http://localhost:1153');
});

// tests/e2e/smoke.spec.ts (AC-009)
test('home responds 200', async ({ page }) => { expect((await page.goto('/'))?.status()).toBe(200); });
test('unknown route renders not-found with 404', async ({ page }) => {
  const res = await page.goto('/definitely-missing');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
```

- [ ] **Step 2: Run** the unit test → FAIL. **Step 3: Implement** `playwright.config.ts` exactly as the shape in `02-design.md` "API and integration contracts" (also `reporter: process.env.CI ? 'github' : 'list'`). `global.setup.ts`: `setup('bootstrap', async () => { /* F02 adds clerkSetup() */ })`. **Step 4: Run** the unit test → PASS. Then `npm run e2e:install` (downloads Chromium locally) and `npm run e2e` → 2 smoke tests PASS (plus the setup project). Paste the summary line into status.md.

---

### Task 10: CI workflow (spec T-010)

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: `tests/unit/repo/ci-workflow.test.ts` (`// @vitest-environment node`)

- [ ] **Step 1: Write failing test** (AC-016): parse with `yaml`; assert `on.push.branches` equals `['main','master']` and `on.pull_request` exists; the job's `actions/setup-node` step has `with['node-version-file'] === '.nvmrc'`; the ordered list of `run` commands equals `['npm ci','npm run check','npm run build','npm run check:bundle','npm audit --audit-level=high']`; the build step's `env` has a key for every entry of `SERVER_KEYS` (import from the script) whose value contains `SENTINEL`.

- [ ] **Step 2: Run** → FAIL. **Step 3: Create** `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main, master]
  pull_request:
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Build with sentinel secrets
        run: npm run build
        env: &sentinels
          DATABASE_URL: postgresql://SENTINEL@localhost/db
          DATABASE_URL_UNPOOLED: postgresql://SENTINEL@localhost/db_unpooled
          DATABASE_URL_TEST: postgresql://SENTINEL@localhost/db_test
          CLERK_SECRET_KEY: sk_SENTINEL_clerk
          CLERK_WEBHOOK_SIGNING_SECRET: whsec_SENTINEL_clerk
          LIVEBLOCKS_SECRET_KEY: sk_SENTINEL_liveblocks
          LIVEBLOCKS_WEBHOOK_SECRET_KEY: whsec_SENTINEL_liveblocks
          BLOB_READ_WRITE_TOKEN: SENTINEL_blob
          TRIGGER_SECRET_KEY: SENTINEL_trigger
      - name: Bundle secret check
        run: npm run check:bundle
        env: *sentinels
      - run: npm audit --audit-level=high
```

YAML anchors are supported by GitHub Actions only in recent runner parsers — if the `yaml` test or a later CI run rejects the alias, duplicate the env map instead (UNVERIFIED; the unit test parses anchors either way, so the real proof is the first CI run).

- [ ] **Step 4: Run** → PASS.

---

### Task 11: README (spec T-011)

**Files:**
- Modify: `README.md`
- Test: `tests/unit/repo/readme.test.ts` (`// @vitest-environment node`)

- [ ] **Step 1: Write failing test** (AC-026): README contains `drawArc`; a `## Scripts` section that mentions every key of `package.json` `scripts` (as `` `name` ``); links `context/README.md` and `features/README.md`; every line containing `Ghost AI` also contains `former`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Rewrite README**: name + one-paragraph purpose (from `context/project-overview.md`, mention "formerly Ghost AI"), prerequisites (Node 22.12+ via `.nvmrc`), setup (`npm ci`, copy `.env.example` → `.env.local`, all keys optional until their feature), `## Scripts` table, where planning lives (`context/`, `features/`, `docs/superpowers/plans/`), the rule that `No_touch_ai/` is read-only reference, a short Troubleshooting note on Playwright port reuse (EC-015). **Step 4: Run** → PASS.

---

### Task 12: Manual checks, full verification, status, commit (spec T-012 + phase close)

**Files:**
- Modify: `features/00-product-foundation/status.md`, `context/progress-tracker.md`
- Create/delete (not committed): throwaway `app/_probe/` files

- [ ] **Step 1: AC-005 (`server-only`)** — create `app/_probe/client.tsx` (`'use client'`, imports `env` from `@/lib/env`) and `app/_probe/page.tsx` rendering it; run `npm run build`; expect the build to fail with the `server-only` error. Copy the error text to status.md, then delete `app/_probe/` and confirm `git status` no longer lists it. If the build does **not** fail, record that `server-only` is not enforced under Turbopack 16.4 and that FR-017's sentinel check is the effective control (design fallback).
- [ ] **Step 2: Full gate** — run and capture summaries: `npm run check`; `npm run build`; sentinel bundle check locally with the CI env values (`CLERK_SECRET_KEY=sk_SENTINEL_clerk … npm run build && npm run check:bundle`); `npm audit --audit-level=high`; `npm run e2e`.
- [ ] **Step 3: Clean-clone check (AC-029 interim)** — `git stash` is **not** used (it would touch owner edits). Instead, after the commit in Step 6, clone the local repo to a scratch directory, run `npm ci && npm run check && npm run build` there with no `.env.local`, and record the result. The CI-run URL for AC-029 stays "pending — requires push authorization".
- [ ] **Step 4: AC-027 record** — `git status --short` and `git diff --name-only` showing that `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `AGENTS.md`, `next.config.ts`, `No_touch_ai/**` have no F00 changes; `grep -n "cacheComponents\|partialPrefetching\|agentFeedback" next.config.ts` output.
- [ ] **Step 5: Update `status.md`** — Status `Verification` → `Completed` only if every AC is verified (else list unmet); resolved package versions; AC-005/AC-027/AC-029 records; the AC-007 resolution note; any lint override added for owner files. Update `progress-tracker.md` (F00 row, next step: F01 approval). Only with the owner's authorization for status updates (granted for this phase by approving the plan).
- [ ] **Step 6: Commit (requires owner's commit authorization)** — verify identity (`git config user.name` = `krishna`, `user.email` = `krishnagtkr@gmail.com`, matches commit `1ac4b34`). The real index holds the owner's staged `public/*.svg` deletions and `.gitignore` holds the owner's uncommitted `/features/curr` line, so build the commit in a **temporary index** that starts from `HEAD`; the real index and working tree are never reset or rewritten:

```bash
F00_PATHS=".nvmrc package.json package-lock.json .env.example eslint.config.mjs vitest.config.mts playwright.config.ts README.md lib/env.ts lib/env.public.ts lib/errors.ts lib/logger.ts lib/utils.ts app/error.tsx app/global-error.tsx app/not-found.tsx scripts tests .github"
export GIT_INDEX_FILE="$TEMP/f00.index"
git read-tree HEAD                       # temp index = last commit (no owner changes)
git add $F00_PATHS                       # F00 files from the working tree
{ git show HEAD:.gitignore; printf '%s
' '/playwright-report/' '/test-results/' '/blob-report/' '/lib/generated/'; } > "$TEMP/gitignore.f00"
git update-index --cacheinfo 100644,"$(git hash-object -w "$TEMP/gitignore.f00")",.gitignore   # only F00's 4 lines
git diff --cached --name-status HEAD     # review: only F00 paths + .gitignore
git commit -m "feat(foundation): add toolchain, env validation, test harness, lint rules, and CI (F00)"
unset GIT_INDEX_FILE
git restore --staged --source=HEAD -- $F00_PATHS .gitignore   # sync the real index for F00 paths only; leaves public/*.svg staged deletions alone
git show --stat --format='%h %an <%ae> %s' HEAD
git status --short
```

Expected: `git show` lists only F00 paths and `.gitignore` (+4 lines), author `krishna <krishnagtkr@gmail.com>`. `git status` afterwards shows exactly what it showed before F00 began: the owner's `app/*` edits, the staged `public/*.svg` deletions, ` M .gitignore` (only the `/features/curr` line), and the untracked planning docs. If any of that differs, stop and report. Do not push. `features/00-product-foundation/status.md`, `context/progress-tracker.md`, this plan, and the rest of the planning package are not in this commit; committing planning docs is a separate owner decision.

- [ ] **Step 7: Report** in the CLAUDE.md §9 format and stop. F01 needs its own approval.
