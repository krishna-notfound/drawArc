# F02 — Test Plan

Layers per `context/testing-strategy.md`. Clerk is mocked only at the `lib/auth.ts` seam (`createRequireUser(deps)`) and at the `handleClerkEvent(evt, deps)` seam; SDK internals are never mocked. L2 uses `DATABASE_URL_TEST` (Neon test branch, `prisma migrate reset --force` in a global setup). L3 uses `@clerk/testing` with user A.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/auth/proxy.test.ts` | read `proxy.ts`; import config | regex assertions; `unstable_doesProxyMatch` for 3 paths | default export + matcher; forbidden tokens absent; match results |
| TC-002 | AC-002b | L1 | `tests/unit/auth/layout-structure.test.ts` | read `app/layout.tsx` | index of `<body`, `<ClerkProvider`, `<Providers` | body < ClerkProvider < Providers |
| TC-003 | AC-002 | L3 | `tests/e2e/auth.spec.ts` | signed-in context | `/editor` | `UserButton` trigger visible |
| TC-004 | AC-003 | L1 | `tests/unit/auth/clerk-appearance.test.ts` | import module + read source | regex per variable; no `#` | pass |
| TC-005 | AC-004 | L3 | `tests/e2e/auth.spec.ts` | signed-out; 1280×800 then 390×844 | query wordmark/tagline/features/form; count `img`/`canvas`; scrollHeight | two-panel then form-only; none; no long scroll |
| TC-006 | AC-005 | L3 | `tests/e2e/auth.spec.ts` | signed-out | `/sign-in`, `/sign-up` | 200 + form with email field |
| TC-007 | AC-006 | L3 | `tests/e2e/auth.spec.ts` | signed-in | `/sign-in`, `/sign-up` | URL ends `/editor`; no form rendered |
| TC-008 | AC-007 | L3 | `tests/e2e/auth.spec.ts` | signed-out and signed-in | `/` | `/sign-in` vs `/editor` |
| TC-008b | AC-007b | L1 | `tests/unit/auth/layout-structure.test.ts` | read `app/page.tsx` | source scan | `<Suspense` present, no top-level `await` |
| TC-009 | AC-008 | L3 | `tests/e2e/auth.spec.ts` | both contexts | `/editor` | redirect vs shell + empty state + `UserButton` |
| TC-010 | AC-009 | L3 | `tests/e2e/auth.spec.ts` | signed-in; `instant()` | assert skeleton; scan `page.content()` and the document response body | skeleton visible; no `privateMetadata`/`clerkId`/`sk_` |
| TC-011 | AC-010 | L1 | `tests/unit/lib/env.test.ts`, `tests/unit/repo/env-example.test.ts` | unset each activated key in turn | import | throws naming the key; `.env.example` has the four redirect keys/values |
| TC-012 | AC-011 | L0 | `npm run check` (`prisma validate`) | — | validate | exit 0 |
| TC-012b | AC-011b | L1 | `tests/unit/auth/schema.test.ts` | read schema text | text assertions | generator output, no datasource url, 8 fields, 2 uniques |
| TC-013 | AC-012 | L2 | `tests/integration/auth/migration.test.ts` | reset test branch | `prisma migrate deploy`; query `information_schema` | 1 migration; columns and unique indexes as listed |
| TC-014 | AC-013 | L1 | `tests/unit/auth/prisma-singleton.test.ts` | `vi.mock('@prisma/adapter-neon')`; `NODE_ENV=development` | import twice | same instance; adapter constructed once |
| TC-015 | AC-014 | L1 | `tests/unit/auth/require-user.test.ts` | fakes: `auth`, `redirect` spy | throw mode; redirect mode; `returnTo` safe/unsafe ×3 | `AccessError` 401; `/sign-in`; encoded `redirect_url`; unsafe dropped |
| TC-016 | AC-015 | L1 | `tests/unit/auth/require-user.test.ts` | in-memory fake `db.user`; `currentUser` variants | existing row; null; no-email; throwing | no `currentUser` call; UNAUTHENTICATED; VALIDATION; UPSTREAM; no writes in the failing cases |
| TC-017 | AC-016 | L2 | `tests/integration/auth/require-user.test.ts` | real `prisma`; fake `auth`/`currentUser`; `bind` spy | `Promise.all` ×5 | one row; same id; `bind` called with lowercase email |
| TC-018 | AC-017 | L2 | `tests/integration/auth/require-user.test.ts` | `makeUser({ deletedAt: new Date() })`; fake `currentUser` with new name | `requireUser()` | `deletedAt` null; name updated |
| TC-019 | AC-018 | L1 | `tests/unit/auth/map-clerk-user.test.ts` | fixture matrix (backend + webhook shapes) | map | per-case expectations |
| TC-020 | AC-019 | L2 | `tests/integration/auth/users.test.ts` | real `prisma` | upsert ×2; upsert changed; markDeleted existing/missing | one row; updated; `'marked'`/`'missing'` |
| TC-021 | AC-020 | L2 | `tests/integration/webhooks/clerk.test.ts` | real env secret for tests (`whsec_test…`); DB query counter | POST ×3 (no headers / wrong secret / tampered body) | 400 ×3; zero queries; row count unchanged |
| TC-022 | AC-021 | L1 | `tests/unit/auth/clerk-webhook.test.ts` | fake db | reversed order; replay; deleted-then-stale-updated | last payload wins; one row; `deletedAt` kept |
| TC-023 | AC-022 | L1 | `tests/unit/auth/clerk-webhook.test.ts` | fake db; logger spy | unknown type; no email; missing id | `handled: false` with reasons; `warn` logged |
| TC-024 | AC-023 | L2 | `tests/integration/webhooks/clerk.test.ts` | two users; `svix` signer (or injected verify); DB failure via disconnected client | signed conflicting update; signed event with broken db | 200 `email-conflict` + error log; 502 `UPSTREAM` |
| TC-025 | AC-024 | L1 | `tests/unit/repo/next-config.test.ts` | import config | assert `remotePatterns` + flags | exact pattern; flags unchanged |
| TC-025b | AC-024b | L3 | `tests/e2e/auth.spec.ts` | signed-in user with avatar | wait for avatar `img` response | image 200 |
| TC-026 | AC-025 | L1 | `tests/unit/auth/no-clerk-user-to-client.test.ts` | glob `'use client'` files | forbidden imports/props scan | zero matches |
| TC-027 | AC-026 | L1 | `tests/unit/repo/toolchain.test.ts` | — | script assertions | `check` ends with `prisma validate`; `postinstall`, `db:*` present |
| TC-027b | AC-026b | L0 | `npm run check` | F02 branch | run | exit 0; output in status.md |
| TC-028 | AC-027 | L3 | `tests/e2e/global.setup.ts`, `tests/e2e/auth.spec.ts` | `E2E_USER_A_*`; `clerkSetup()`; `setupClerkTestingToken` | fill email/password; submit; open `UserButton`; sign out | `/editor`; then `/sign-in` |
| TC-029 | AC-028 | L0 | — | valid env | `npm run build` | no `blocking-prerender`; routes listed; output in status.md |
| TC-030 | AC-029 | L2 | `tests/integration/webhooks/clerk.test.ts` | see AUTHZ-MATRIX | POST/GET/PUT/DELETE with and without signature | webhook rows of the matrix; page rows are TC-006–TC-009 |

## Collaboration / concurrency cases

No room is touched. Concurrency cases in F02 are data-level: TC-017 (parallel first sign-in), TC-022 (webhook reordering/replay), TC-024 (email conflict). Offline/reconnect: not applicable (server-gated pages; client offline handling begins in F05).

## AUTHZ-MATRIX

Roles (owner/editor/viewer) do not exist until F03; the matrix for F02 is session-based. "Authenticated" = Clerk session for user A.

| Endpoint | Unauthenticated | Authenticated | Machine (Svix) valid signature | Invalid/missing signature | Layer / TC |
|---|---|---|---|---|---|
| `GET /` | 307 → `/sign-in` | 307 → `/editor` | n/a | n/a | L3 TC-008 |
| `GET /editor` | 307 → `/sign-in` | 200 | n/a | n/a | L3 TC-009 |
| `GET /sign-in` | 200 | 307 → `/editor` | n/a | n/a | L3 TC-006, TC-007 |
| `GET /sign-up` | 200 | 307 → `/editor` | n/a | n/a | L3 TC-006, TC-007 |
| `POST /api/webhooks/clerk` | 400 (no signature) | 400 (a session does not substitute for a signature) | 200 | 400, no side effects | L2 TC-021, TC-024 |
| `GET/PUT/DELETE /api/webhooks/clerk` | 405 (Next default for unexported methods) | 405 | 405 | 405 | L2 TC-021 (one extra request) |

Member-matched-by-email binding ("bound on first call" row of the standard matrix) is exercised structurally here (TC-017 asserts the hook is invoked) and functionally in F03 once `ProjectMember` exists.

## Not tested automatically, and why

- Clerk-hosted flows (email verification codes, password reset, account deletion UI): Clerk-owned; `@clerk/testing` bypasses bot detection but does not script verification emails. Sign-in with password is enough to prove integration.
- Real Svix delivery to a deployed endpoint: requires a public URL and the Clerk dashboard; verified manually once on the first preview deployment (F15) by triggering a profile change and checking the row — recorded in status.md.
- `ClerkProvider` prerender behaviour (UNVERIFIED): the build output check (TC-029) is the test; if an insight appears, the fallback in `02-design.md` applies and TC-029 is re-run.
- The `bindPendingMemberships` body: F03.
- Membership removal on `user.deleted`: the `ProjectMember` table does not exist yet; obligation carried to F03/F12 (recorded in status.md open issues).
