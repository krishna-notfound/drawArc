# F02 — Design

## Architecture and components

```
Browser ── GET /, /editor, /sign-in ──► proxy.ts (clerkMiddleware(): session only) ──► page
                                                                                       └─ <Suspense> child: await auth() → requireUser() → redirect | render
Svix ── POST /api/webhooks/clerk ──► proxy.ts (no decision) ──► route.ts: verifyWebhook → handleClerkEvent → lib/users → Prisma → Neon
```

| Path | New / modified | Client/Server | Responsibility |
|---|---|---|---|
| `proxy.ts` | new | Node (proxy) | `clerkMiddleware()` + matcher; nothing else |
| `app/layout.tsx` | modified | server | `<ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/sign-in">` inside `<body>`, wrapping `Providers` |
| `lib/clerk-appearance.ts` | new | isomorphic (no React) | `{ baseTheme: dark, variables: { … var(--…) … } }` |
| `app/(auth)/layout.tsx` | new | server | two-panel auth layout |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | new | server page + Clerk client components | `<Suspense><RedirectIfSignedIn/></Suspense>` + `<SignIn/>`/`<SignUp/>` |
| `app/page.tsx` | replaced | server | `<Suspense fallback={null}><HomeRedirect/></Suspense>` |
| `app/editor/page.tsx` | modified | server | `<Suspense fallback={<EditorHomeSkeleton/>}><EditorHome/></Suspense>`; `EditorHome` calls `requireUser({ unauthenticated: 'redirect' })` and renders `EditorShell navbarRight={<UserMenu/>}` |
| `components/editor/user-menu.tsx` | new | client | wraps Clerk `UserButton` with `appearance` and `afterSignOutUrl` |
| `components/editor/editor-home-skeleton.tsx` | new | server | static fallback (navbar + avatar placeholder + empty-state heading) |
| `lib/auth.ts` | new | server | `requireUser`, `createRequireUser`, `AuthUser` |
| `lib/users.ts` | new | server | mappers, upsert, markDeleted, `bindPendingMemberships` stub |
| `lib/clerk-webhook.ts` | new | server | `handleClerkEvent(evt, deps)` pure-ish handler (deps injected) |
| `app/api/webhooks/clerk/route.ts` | new | route handler | thin: verify → handle → respond |
| `lib/prisma.ts`, `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/<ts>_user/migration.sql` | new | server | data layer bootstrap |
| `schemas/clerk.ts` | new | server | Zod: `ClerkUserInputSchema`, `ClerkWebhookUserSchema`, `ClerkDeletedSchema` |
| `lib/env.ts`, `lib/env.public.ts`, `.env.example`, `next.config.ts`, `package.json`, `.gitignore` (`lib/generated/`) | modified | — | activation, images, scripts |
| `tests/factories.ts` (`makeUser`), `tests/e2e/global.setup.ts` (`clerkSetup`), `tests/e2e/auth.spec.ts`, `tests/unit/auth/**`, `tests/integration/auth/**`, `tests/integration/webhooks/clerk.test.ts` | new/modified | — | verification |

Dependency direction holds: `app → components → lib → @clerk/nextjs, generated Prisma`. `lib/auth.ts` imports `next/navigation` (`redirect`) — an SDK import, permitted.

## Domain model and TypeScript contracts

Prisma (`prisma/schema.prisma`, migration 1):

```prisma
generator client { provider = "prisma-client"  output = "../lib/generated/prisma" }
datasource db { provider = "postgresql" }
model User {
  id        String    @id @default(cuid())
  clerkId   String    @unique
  email     String    @unique
  name      String?
  avatarUrl String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
}
```
F03 adds relation fields (`ownedProjects`, `memberships`, `sentInvites`) in migration 2.

```ts
// lib/auth.ts
export interface AuthUser { id: string; clerkId: string; email: string; name: string | null; avatarUrl: string | null }
export interface RequireUserOptions { unauthenticated?: 'throw' | 'redirect'; returnTo?: string }   // default 'throw'
export interface RequireUserDeps {
  auth: () => Promise<{ userId: string | null }>;
  currentUser: () => Promise<BackendUserLike | null>;
  db: Pick<PrismaClient, 'user'>;
  bindPendingMemberships: (user: AuthUser) => Promise<{ bound: number }>;
  redirect: (url: string) => never;
  logger: Logger;
}
export function createRequireUser(deps: RequireUserDeps): (opts?: RequireUserOptions) => Promise<{ user: AuthUser }>;
export const requireUser = createRequireUser({ auth, currentUser, db: prisma, bindPendingMemberships, redirect, logger });

// lib/users.ts
export interface ClerkUserInput { clerkId: string; email: string; name: string | null; avatarUrl: string | null }
export interface BackendUserLike { id: string; firstName: string | null; lastName: string | null; username: string | null; imageUrl: string;
  primaryEmailAddressId: string | null; emailAddresses: { id: string; emailAddress: string }[] }
export function mapBackendUser(u: BackendUserLike): ClerkUserInput | null;
export function mapWebhookUser(d: ClerkWebhookUser): ClerkUserInput | null;      // snake_case payload (Zod-parsed)
export function upsertUserFromClerk(db, input: ClerkUserInput): Promise<User>;    // upsert where clerkId; update sets email/name/avatarUrl, deletedAt: null only when `opts.resurrect`
export function markUserDeleted(db, clerkId: string): Promise<'marked' | 'missing'>;
export function bindPendingMemberships(user: AuthUser): Promise<{ bound: number }>;   // F02: returns { bound: 0 }; F03 implements

// lib/clerk-webhook.ts
export type ClerkEventResult = { handled: boolean; reason?: 'unknown-type' | 'no-email' | 'missing-id' | 'email-conflict' };
export function handleClerkEvent(evt: WebhookEvent, deps: { db; logger; bindPendingMemberships }): Promise<ClerkEventResult>;
```

`upsertUserFromClerk` semantics: `create` uses the input and `deletedAt: null`; `update` sets `email`, `name`, `avatarUrl` and sets `deletedAt: null` only when called from `requireUser` (`{ resurrect: true }`); webhook `user.created/updated` never clears `deletedAt` (EC-006).

Zod (`schemas/clerk.ts`): `ClerkWebhookUserSchema = z.object({ id: z.string().min(1), email_addresses: z.array(z.object({ id: z.string(), email_address: z.string().email() })), primary_email_address_id: z.string().nullable(), first_name: z.string().nullable(), last_name: z.string().nullable(), username: z.string().nullable(), image_url: z.string().url() })`; `ClerkDeletedSchema = z.object({ id: z.string().min(1).optional(), deleted: z.boolean() })`.

`lib/clerk-appearance.ts` (names UNVERIFIED for 7.9 — see facts table):

```ts
export const clerkAppearance = { baseTheme: dark, variables: {
  colorPrimary: 'var(--accent-primary)', colorBackground: 'var(--bg-surface)', colorText: 'var(--text-primary)',
  colorTextSecondary: 'var(--text-secondary)', colorInputBackground: 'var(--bg-elevated)', colorInputText: 'var(--text-primary)',
  colorDanger: 'var(--state-error)', colorSuccess: 'var(--state-success)', colorWarning: 'var(--state-warning)',
  colorNeutral: 'var(--text-muted)', borderRadius: '0.75rem', fontFamily: 'var(--font-geist-sans)' } } as const;
```

## Data and state ownership

| Data | Authoritative | F02 copy | Write path | Notes |
|---|---|---|---|---|
| Identity, credentials, sessions | Clerk | `User` row (`clerkId`, `email`, `name`, `avatarUrl`, `deletedAt`) | `requireUser` lazy upsert; webhook upsert/markDeleted | eventually consistent (data-ownership rule 5); no security decision depends on `name/avatarUrl` |
| Session state in browser | Clerk cookies | none | Clerk | never read by our client code |
| Chrome state | client memory (F01) | — | — | unchanged |

No new derived copies beyond the approved `User` projection (D-011).

## API and integration contracts

| Endpoint | Method | Auth | Min role | Request | Response | Errors |
|---|---|---|---|---|---|---|
| `/api/webhooks/clerk` | POST | Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) via `verifyWebhook` with `CLERK_WEBHOOK_SIGNING_SECRET` | n/a (machine) | Clerk `WebhookEvent` JSON (raw body) | 200 `{ ok: true, handled: boolean, reason? }` | 400 `VALIDATION` (signature); 502 `UPSTREAM` (DB failure — `httpStatusFor('UPSTREAM')`, D-036; any non-2xx is retried by Svix) |
| `/` | GET | session optional | — | — | 307 `/editor` or `/sign-in` | — |
| `/editor` | GET | session required (`requireUser` redirect mode) | — | — | 200 page | 307 `/sign-in` |
| `/sign-in`, `/sign-up` | GET | public | — | — | 200 page; 307 `/editor` if signed in | — |

`requireUser()` contract for callers (F03+): pages → `requireUser({ unauthenticated: 'redirect', returnTo })` inside a Suspense child; route handlers → `requireUser()` then `errorResponse(err)` in their own catch (401); Server Actions → `requireUser()` and `toActionError` (F03) → `{ ok: false, error: { code: 'UNAUTHENTICATED' } }`.

Clerk dashboard contract (owner-performed, separately authorized): dev instance with Email+Password enabled; webhook endpoint `https://<host>/api/webhooks/clerk` subscribed to `user.created`, `user.updated`, `user.deleted`; signing secret copied to `CLERK_WEBHOOK_SIGNING_SECRET`; "require email address" enabled (EC-003); two E2E test users.

## Security and validation

- Authentication read only via `auth()`/`currentUser()` inside `lib/auth.ts`; proxy makes no decisions (Clerk guidance; `createRouteMatcher` deprecated).
- Webhook: authenticate (signature) → validate (Zod on `evt.data`) → act; 400 before any DB access; `svix-id` logged as `requestId`; handler idempotent (upsert) so retries are safe; no secrets in logs (F00 redaction covers `secret`/`token` keys).
- Client exposure: only `AuthUser` (own `id`, `name`, `avatarUrl`) may reach client components; `clerkId`/`email` of other users never leave the server (FR-014). Clerk's full `User` (contains `privateMetadata`) is consumed inside `lib/users.ts` mappers only.
- Rate limiting: webhook endpoint relies on Svix signing + Vercel firewall; no DB-backed limit (writes are upserts keyed by Clerk id). `currentUser()` called at most once per missing row.
- Secrets: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `DATABASE_URL*` server-only (F00 `server-only` + sentinel check).
- Threats considered: forged webhook (signature), replayed webhook (idempotent), email takeover via webhook (unique constraint + EC-007 logging), open redirect via `returnTo` (only same-origin paths starting with `/` and not `//` are accepted; otherwise dropped).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `@clerk/nextjs` 7.9.19; peer range includes Next `^16.0.10` and React `~19.3.0-0` | https://registry.npmjs.org/@clerk%2Fnextjs/latest | 2026-10-22 |
| Next 16+ uses `proxy.ts`; file is `export default clerkMiddleware()` + `config.matcher`; `createRouteMatcher` deprecated; "Middleware is not the best place to protect routes" | https://clerk.com/docs/reference/nextjs/clerk-middleware ; https://clerk.com/docs/nextjs/getting-started/quickstart | 2026-10-22 |
| `ClerkProvider` goes inside `<body>` | https://clerk.com/docs/nextjs/getting-started/quickstart | 2026-10-22 |
| `await auth()` → `{ userId, isAuthenticated, redirectToSignIn }`; server-side only; requires `clerkMiddleware` | https://clerk.com/docs/reference/nextjs/app-router/auth | 2026-10-22 |
| `currentUser()` fetches the Backend `User`, deduped per request, counts toward Backend API rate limit, includes `privateMetadata` | https://clerk.com/docs/reference/nextjs/app-router/current-user | 2026-10-22 |
| Backend `User` fields: `id`, `firstName`, `lastName`, `username`, `imageUrl`, `hasImage`, `emailAddresses[]`, `primaryEmailAddressId` | https://clerk.com/docs/reference/backend/types/backend-user | 2026-10-22 |
| Webhooks via Svix; retries on non-2xx with the same `svix-id`; out-of-order/duplicate delivery possible; `verifyWebhook(req)` from `@clerk/nextjs/webhooks`; `CLERK_WEBHOOK_SIGNING_SECRET`; return 200 on success, 400 on failure; route must be public | https://clerk.com/docs/webhooks/overview ; https://clerk.com/docs/webhooks/sync-data | 2026-10-22 |
| Avatar host `https://img.clerk.com`; `remotePatterns` entry `{ protocol: 'https', hostname: 'img.clerk.com', pathname: '/**' }` | https://clerk.com/docs/guides/secure/best-practices/csp-headers ; `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` | 2026-10-22 |
| `@clerk/testing` 2.2.49: `clerkSetup()` in a project-based global setup; `setupClerkTestingToken({ page })`; needs dev instance keys and Email+Password | https://clerk.com/docs/testing/playwright/overview | 2026-10-22 |
| Prisma 7.10.1 (npm `latest` is an 8 RC — pin `~7.10`); `prisma.config.ts` with `env('DATABASE_URL_UNPOOLED')`; `prisma-client` generator requires `output`; env not auto-loaded (`dotenv/config`); runtime `new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })` | https://neon.com/docs/guides/prisma ; https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 | 2026-10-22 |
| Cache Components: `cookies()`-reading auth must sit in a Suspense child; `redirect()` throws and is not cached; Server Function POSTs bypass proxy matchers so each must re-auth | `01-app/02-guides/authentication-with-cache-components.md`; https://nextjs.org/docs/app/api-reference/file-conventions/proxy | 2026-10-22 |
| UNVERIFIED: dark base theme import path in Clerk 7.9 (`@clerk/themes` `dark` vs reference's `@clerk/ui/themes`) and the exact appearance variable names (`colorInputBackground`, `colorTextSecondary` may have been renamed). Fallback: T-002 reads the 7.9 appearance reference and records the mapping; the no-hex test (AC-003) is name-agnostic. | — | — |
| UNVERIFIED: whether `<ClerkProvider>` without the `dynamic` prop reads request data during prerender (would trigger `blocking-prerender-runtime`). Fallback: keep it static (no `dynamic` prop); if the build insight appears, move `ClerkProvider` into a Suspense-wrapped child of `body`. | — | — |
| UNVERIFIED: Prisma `upsert` on a single unique `where` is executed as `INSERT … ON CONFLICT` (atomic). Fallback: catch `P2002` and re-read (EC-001 is tested either way). | — | — |
| UNVERIFIED: `svix` package `Webhook.sign()` compatible with `verifyWebhook` for L2 valid-signature tests. Fallback: inject `verify` into the route via `createWebhookHandler(deps)` and test the signature path only negatively at L2. | — | — |
