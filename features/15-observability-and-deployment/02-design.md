# F15 — Design

## Architecture and components

This feature adds no product routes. It sits at the outer edge of the system: Vercel/Neon/Clerk/Liveblocks/Blob configuration around the app, plus cross-cutting modules in `lib/` used by every route handler and Server Action.

Files created:

| File | Responsibility |
|---|---|
| `lib/request-id.ts` | `newRequestId()` → `crypto.randomUUID()`; `withRequest(handler)` wrapper for route handlers that creates the id, binds a child logger, and passes the id to F00's `errorResponse(err, { requestId })`. |
| `lib/errors.ts` (F00-owned, modified) | `errorResponse(err, opts?: { requestId })` gains the optional `requestId` and echoes it in the body `{ error: { code, message, requestId, fieldErrors? } }`; `ActionError` gains `requestId?: string`. No `lib/http.ts` is created (D-036: one error module). |
| `app/global-error.tsx` | Self-contained document error boundary. |
| `app/editor/[projectId]/error.tsx`, `app/editor/[projectId]/not-found.tsx` | Segment boundaries (copy in 01-requirements). |
| `scripts/scan-bundle.ts` | Reads server-scope keys from `lib/env.ts` schema, loads their values from the current env, greps `.next/static/**` and `.next/server/app/**/*.js` client chunks (`.next/static` is what ships to browsers) for each value and for the patterns `sk_live_`, `sk_test_`, `whsec_`, `vercel_blob_rw_`; exits 1 on a hit. |
| `scripts/check-pins.ts` | Asserts `package.json` pins per D-023 (`@xyflow/react` `~12.12`, all `@liveblocks/*` identical exact version, `prisma`/`@prisma/*` `~7.10`). |
| `scripts/export-room.ts` | `getStorageDocument(roomId)` → writes `exports/<roomId>-<iso>.json`; used by the recovery runbook. |
| `tests/e2e/perf.spec.ts` | NFR-003/NFR-004 measurements (below). |
| `tests/fixtures/canvas/large-500-nodes.json` | Generated once by `scripts/gen-large-fixture.ts` (deterministic ulids, 25×20 grid, 800 edges between grid neighbours), schema v1. |
| `docs/runbooks/recovery.md`, `docs/runbooks/release.md`, `docs/runbooks/dependencies.md` | Runbooks (Markdown; the only documentation files this feature creates, all explicitly required by FR-012–FR-014). |
| `docs/perf/<commit>.md` | Manual profile record (F15-D3). |
| `.github/workflows/ci.yml` | Reuse F00's workflow; add the `e2e-on-preview` job. |

Files modified: `next.config.ts` (`headers()`, `images.remotePatterns`), `lib/logger.ts` (child logger with bound fields), every route handler / Server Action from F02–F14 (adopt `withRequest` / `newRequestId`; mechanical), `app/error.tsx` (F01 shell → full copy), `.env.example`, `package.json` scripts (`scan:bundle`, `check:pins`, `e2e:preview`).

Dependency direction respected: `app → components → lib`; scripts import from `lib/` only.

## Domain model and TypeScript contracts

No Prisma changes. Contracts introduced:

```ts
// lib/request-id.ts
export type RequestId = string & { readonly __brand: 'RequestId' };
export function newRequestId(): RequestId;               // crypto.randomUUID()
export interface RequestContext { requestId: RequestId; log: Logger }   // Logger from lib/logger.ts
export function withRequest<T extends unknown[]>(
  handler: (ctx: RequestContext, ...args: T) => Promise<Response>
): (...args: T) => Promise<Response>;                     // creates ctx, catches *our* thrown AccessError/ZodError → errorResponse; rethrows anything else

// lib/logger.ts (F00; extended)
export interface LogFields { requestId?: string; userId?: string; projectId?: string; runId?: string; [k: string]: unknown }
export interface Logger {
  info(obj: LogFields, msg: string): void; warn(obj: LogFields, msg: string): void; error(obj: LogFields & { err?: unknown }, msg: string): void;
  child(bound: LogFields): Logger;                        // merges bound fields into every call
}

// lib/errors.ts (F00) — error body shape used by every route handler (architecture-context.md "Error handling")
export interface ErrorBody { error: { code: ErrorCode; message: string; requestId: string; fieldErrors?: Record<string, string[]> } }
export function errorResponse(err: unknown, opts?: { requestId?: string }): NextResponse;   // F00 signature + optional requestId
```

`ActionResult<T>` (F03) gains `error.requestId: string` on the failure branch. The client never needs to parse it; it is displayed verbatim in toasts/boundaries.

Log line shape (one JSON object per line on stdout): `{ level, time, msg, requestId, userId?, projectId?, runId?, err?: { name, message, stack?, digest? } }`. `stack` is included only when `NODE_ENV !== 'production'` or `level === 'error'`.

## Data and state ownership

Unchanged from data-ownership.md. This feature touches only "Secrets / configuration" (authoritative: Vercel project env; Trigger.dev env for tasks from F17). Logs are ephemeral in Vercel runtime logs (retention per Vercel plan — UNVERIFIED duration; a log drain is optional under D-019 Option A). Performance evidence is owned by the repository (`docs/perf/`, F15-D3).

## Environment inventory (FR-006)

Scope: S = server-only (never in bundle), C = client-safe (`NEXT_PUBLIC_*`). Environments: Dev = `.env.local` + Vercel Development, Prev = Vercel Preview, Prod = Vercel Production. "Validated" = present in the `lib/env.ts` Zod schema.

| Name | Scope | Environments | Source of value | Validated |
|---|---|---|---|---|
| `DATABASE_URL` | S | Dev (dev branch), Prev (injected per deployment), Prod | Neon integration (pooled, `-pooler` host) | yes (url) |
| `DATABASE_URL_UNPOOLED` | S | Dev, Prev (injected), Prod | Neon integration (direct host); used by `prisma.config.ts` and `prisma migrate deploy` | yes (url) |
| `DATABASE_URL_TEST` | S | CI only | Dedicated Neon test branch (testing-strategy.md) | optional |
| `CLERK_SECRET_KEY` | S | Dev+Prev (Development instance), Prod (Production instance) | Clerk dashboard | yes (`sk_`) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | S | Dev (ngrok/`clerk` tunnel endpoint), Prev (one shared preview endpoint — see F15 note below), Prod | Clerk webhook endpoint settings | yes (`whsec_`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | C | all | Clerk dashboard | yes (`pk_`) |
| `LIVEBLOCKS_SECRET_KEY` | S | Dev+Prev (development key), Prod (production key) | Liveblocks dashboard | yes (`sk_`) |
| `LIVEBLOCKS_WEBHOOK_SECRET_KEY` | S | Dev, Prev, Prod (one webhook endpoint per Liveblocks environment) | Liveblocks dashboard | yes (`whsec_`) |
| `LIVEBLOCKS_BASE_URL` | S | tests only (node client → `npx liveblocks dev`) | F05 | optional (url) |
| `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` | C | tests only (points at `npx liveblocks dev`) | testing-strategy.md | optional |
| `NEXT_PUBLIC_E2E_HOOKS` | C | E2E/preview only (`'1'` enables `window.__rf`, `dev-add-node`, test hooks) | F06 | optional |
| `AI_PROVIDER`, `AI_MODEL` | S | Dev, Prev, Prod (`fake` default outside production) | **added by F17** | — |
| `BLOB_READ_WRITE_TOKEN` | S | Dev (`vercel env pull`), CI | Vercel Blob store tokens | optional (absent on Vercel where OIDC is used) |
| `BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN` | S | Prev, Prod (auto) | Vercel (OIDC, auto-rotated) | no (platform-provided; not read by our code) |
| `NODE_ENV`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` | S | auto | Vercel | optional (logged at boot) |
| `TRIGGER_SECRET_KEY` | S | Dev, Prev, Prod | **added by F17** | — |
| `LLM_API_KEY` (placeholder name; final name set at F17 SDK selection) | S | Trigger.dev env only | **added by F17** | — |
| Trigger.dev-side env (`LIVEBLOCKS_SECRET_KEY`, `DATABASE_URL`, LLM key) | S | Trigger.dev dev/prod | **added by F17** via `syncVercelEnvVars()` build extension | — |

Preview webhook note: Clerk and Liveblocks webhooks need a stable URL; previews have per-deployment URLs. PROPOSED: webhooks are configured for Production and for one fixed preview alias (`drawarc-preview.vercel.app` → latest `main` preview); feature-branch previews receive no webhooks (identity sync falls back to the lazy upsert in `requireUser()`, F02, so previews still work).

Boot validation: `lib/env.ts` is imported by `lib/prisma.ts`, `lib/liveblocks.ts`, `lib/blob.ts`, and `lib/auth.ts`, so any server module evaluation validates the schema; the error message lists missing/invalid keys by name only.

## API and integration contracts

| Surface | Method / path | Auth | Min role | Request | Response | Errors |
|---|---|---|---|---|---|---|
| CSP report sink | `POST /api/csp-report` | none (browsers send reports without credentials) | — | `application/csp-report` or JSON body ≤ 8 KB, Zod-validated minimal shape `{ 'csp-report': { 'document-uri', 'violated-directive', 'blocked-uri' } }` | 204 (log line at `warn`, no other side effect) | 400 `VALIDATION` (> 8 KB or non-JSON); never 5xx on bad input |
| Request-id wrapper | `withRequest(handler)` around every route handler from F02–F14 | unchanged per route | unchanged | unchanged | unchanged | every error body gains `requestId`; `AccessError`/`ZodError`/`RateLimitError` → `errorResponse`; anything else propagates |
| Server Actions | `app/**/actions.ts` (F03, F12) | unchanged | unchanged | unchanged | `ActionResult` failure branch gains `error.requestId` | unchanged |

No other routes, Server Actions, Liveblocks events or Trigger.dev tasks are added. External integrations configured (not coded) here: Vercel project + Neon integration, Clerk instances/webhooks, Liveblocks environments/webhooks, Blob store, GitHub Actions secrets — each an [EXT] task in 04-implementation-plan.md.

## Security and validation

- Threats: secret leakage to the bundle (controls: `scripts/scan-bundle.ts` sentinel scan in CI, `server-only` from F00, env inventory parity test); response-header hardening and clickjacking (controls: the header set below, `frame-ancestors 'none'` + `X-Frame-Options: DENY`); cross-environment webhook replay (control: per-environment signing secrets, AC-004); CSP report flooding (controls: 8 KB cap, Zod shape, `warn`-level log only, Vercel firewall rate limiting; the sink has no state); environment-specific existence leaks (control: the same `AccessDenied`/403 bodies on production as locally, re-run in `e2e-on-preview`).
- Validation: `/api/csp-report` body with Zod; env with the F00 schema at boot; inventory ↔ schema ↔ `.env.example` parity test (AC-007).
- Rate limits: none added in code; Vercel's firewall covers the public report sink.

## Error boundaries (FR-008)

Contract from the Next.js 16.4.2 local docs (`01-getting-started/10-error-handling.md`, `03-file-conventions/error.md`, checked 2026-10-22): `error.tsx` must be `'use client'`; props `{ error: unknown; retry: () => void }` (legacy `reset` also passed); server errors arrive as a generic `Error` with `error.digest`; `global-error.tsx` must render its own `<html>`/`<body>`; `not-found.tsx` per segment, root one also handles unmatched URLs. `unauthorized()`/`forbidden()` are experimental (`experimental.authInterrupts`) and are **not** adopted — F04's `AccessDenied` component stays the only access-denied surface. `catchError` from `next/error` is not used in M1.

Server-side: route handlers never wrap the whole handler in try/catch (code-standards rule 6); `withRequest` catches only our typed errors (`AccessError`, `ZodError`, `RateLimitError`) and lets Next's internals propagate.

## D-019 — error-reporting SaaS (OPEN; both options)

| | Option A — no SaaS (recommended) | Option B — Sentry |
|---|---|---|
| Mechanism | Structured JSON logs → Vercel runtime logs; `error.digest`/`requestId` correlation; optional Vercel log drain to a free tier sink (owner's dashboard task) | `@sentry/nextjs` (version UNVERIFIED; Next 16 compatibility UNVERIFIED) with `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `withSentryConfig` in `next.config.ts`, `global-error.tsx` calling `Sentry.captureException` |
| Env | none | `NEXT_PUBLIC_SENTRY_DSN` (C), `SENTRY_AUTH_TOKEN` (CI only, source maps), `SENTRY_ORG`, `SENTRY_PROJECT` |
| CSP | none | `connect-src` + `report-uri` for the Sentry ingest host; tunnel route `/monitoring` to bypass ad-blockers |
| Tests | AC-009–AC-011 (logs) | plus an L1 test that `beforeSend` strips `userInfo`, cookies, and request bodies |
| Cost/risk | Log retention limited by Vercel plan; no alerting | Dependency outside the plan; bundle size; PII scrubbing obligation; a second place where errors live |
| Changes to this feature | none | T-013 (new, separate authorization) + env rows + CSP rows |

Recommendation (decision-log.md): A for M1; revisit if Vercel logs prove insufficient during the acceptance run.

## Performance verification (FR-010)

`tests/e2e/perf.spec.ts`, Playwright project `preview` (`baseURL` = PR preview URL, two Clerk test users from `@clerk/testing`):

1. `beforeAll`: create a project via the API as user A; `PUT /api/projects/{id}/canvas` with `large-500-nodes.json` (within F13 caps); open the workspace; wait for 500 `.react-flow__node`.
2. **Load** (NFR-003): `performance.getEntriesByType('navigation')` + time to first node render over 5 cold loads; assert p95 < 3,000 ms.
3. **Drag** (NFR-004): `page.evaluate` installs a `requestAnimationFrame` sampler for 3 s while `page.mouse` drags one node 400 px; compute frame deltas; assert p95 < 33 ms. Record all percentiles in the test output.
4. **Propagation** (NFR-003): second context as user B on the same project; A moves a node; B polls `getBoundingClientRect` of that node at 16 ms intervals; delta from A's `pointerup` to B's position change, 20 repetitions; assert p95 < 500 ms.
5. **Storage size** (NFR-004): `GET /api/projects/{id}/canvas` body length < 5 MB (proxy for room Storage size — the room JSON equals the snapshot plus Liveblocks overhead; direct Storage size is UNVERIFIED as an API and is read manually in the dashboard during the profile).
6. Manual: Chrome Performance profile of the drag on the preview, mid-range laptop (owner-defined machine recorded), saved summary to `docs/perf/<commit>.md` (frame histogram, main-thread time, scripting %, commit hash, preview URL).

### Security headers (FR-011)

`next.config.ts` `headers()` for `/(.*)`:

| Header | Value |
|---|---|
| `Content-Security-Policy-Report-Only` (F15-D2) | `default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.<prod-domain>; connect-src 'self' https://*.clerk.accounts.dev https://clerk.<prod-domain> https://*.liveblocks.io wss://*.liveblocks.io; img-src 'self' https://img.clerk.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; frame-ancestors 'none'; report-uri /api/csp-report` — Clerk `img-src` host VERIFIED (https://clerk.com/docs/guides/secure/best-practices/csp-headers, checked 2026-10-22); Clerk script/connect hosts, Liveblocks hosts, and Trigger.dev realtime hosts (M2) UNVERIFIED — resolved from report-only violations in T-010. `'unsafe-inline'` for scripts is required by Next's inline runtime unless nonces are adopted (out of scope M1). |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (belt-and-braces with `frame-ancestors`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

`/api/csp-report` is a public POST route that logs the report body (≤ 8 KB, Zod-validated minimal shape) at `warn` and returns 204 — the only new route, read-only in effect; it is listed in the AUTHZ note in 05-test-plan.md (no auth, no side effects beyond a log line, rate-limited by Vercel's firewall).

`images.remotePatterns`: `[{ protocol: 'https', hostname: 'img.clerk.com' }]` only (code-standards rule 9).

Bundle scan: `npm run build && npm run scan:bundle` in CI after the build step; the script's allowlist is `NEXT_PUBLIC_*` values and `pk_` keys (EC-012).

## Backup / recovery runbook (FR-012) — summary (full text in `docs/runbooks/recovery.md`)

| Loss | Detection | Procedure | Verified source |
|---|---|---|---|
| Postgres rows / schema | Prisma errors, missing projects | Neon: create a branch from a point in time before the incident; swap the Vercel env to that branch or restore via the Neon console | UNVERIFIED page https://neon.com/docs/guides/branch-restore (not in research); branching itself VERIFIED https://neon.com/docs/guides/vercel-managed-integration |
| Liveblocks room Storage | Workspace opens empty for a project with `canvasSavedAt` set | Open the project as any member → the F04 gate's server-side seed (F13 `seedRoomIfEmpty`, D-034) restores it from Blob (invariant 6); if the seed banner reports a failure, reopen once Liveblocks is reachable; alternatively `scripts/export-room.ts` beforehand for a manual copy; dashboard version history restore (24 h Free / 30 d Pro, https://liveblocks.io/pricing checked 2026-10-22) | `getStorageDocument`/`mutateFlow` VERIFIED (liveblocks.md §6, https://liveblocks.io/docs/api-reference/liveblocks-node); dashboard export UNVERIFIED |
| Blob snapshot | `GET …/canvas` 404 while pointer set | Editor edits → autosave rewrites `canvas/{projectId}.json`; `list({ prefix: 'canvas/' })` to audit | VERIFIED https://vercel.com/docs/vercel-blob/using-blob-sdk |
| Both room and snapshot | Empty workspace, `GET …/canvas` 404 | Liveblocks version history only; otherwise data loss (documented residual risk) | — |

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Neon Vercel-managed integration creates `preview/<git-branch>` per preview deployment and injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (+ `PG*`); migrations via overridden build command `npx prisma migrate deploy && npm run build` | https://neon.com/docs/guides/vercel-managed-integration | 2026-10-22 |
| Pooled host has `-pooler` suffix; use direct URL for migrations | https://neon.com/docs/connect/connection-pooling | 2026-10-22 |
| Prisma 7: `prisma.config.ts` holds the CLI datasource URL (direct); `migrate deploy` exists in 7 | https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 | 2026-10-22 |
| Blob access mode is a store property chosen at creation and cannot be changed; private reads via `get(pathname, { access: 'private' })`; OIDC auth on Vercel; `BLOB_READ_WRITE_TOKEN` for CI/local | https://vercel.com/docs/vercel-blob/private-storage, https://vercel.com/docs/vercel-blob | 2026-10-22 |
| `list({ prefix, limit ≤ 1000, cursor })` returns `{ blobs, cursor, hasMore }` | https://vercel.com/docs/vercel-blob/using-blob-sdk | 2026-10-22 |
| Clerk CSP: `img-src https://img.clerk.com` | https://clerk.com/docs/guides/secure/best-practices/csp-headers | 2026-10-22 |
| Clerk webhooks verified with `verifyWebhook(req)`; endpoint is public; events retried by Svix | https://clerk.com/docs/webhooks/sync-data | 2026-10-22 |
| Liveblocks Free: 10 connections/room, non-commercial only, 24 h version history; Pro $30/mo, 30 d | https://liveblocks.io/pricing | 2026-10-22 |
| Liveblocks `WebhookHandler.verifyRequest` with raw body; retries 0s…10h; endpoint auto-disabled after 5 days of failures | https://liveblocks.io/docs/platform/webhooks | 2026-10-22 |
| `getStorageDocument(roomId)` exists in `@liveblocks/node` | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| Next 16 error boundary contract (`'use client'`, `{ error, retry }`, `digest`, `global-error` own html/body); `unauthorized()`/`forbidden()` experimental | local docs `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`, `03-file-conventions/error.md`, `04-functions/unauthorized.md` | 2026-10-22 |
| UNVERIFIED: Vercel request-id header name; Vercel runtime log retention; Liveblocks/Clerk script+connect CSP hosts; Trigger.dev realtime hosts; Neon PITR page; Liveblocks dashboard Storage export; `@sentry/nextjs` Next 16 support | — | — |
