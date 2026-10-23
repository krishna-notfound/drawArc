# F02 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority (must/should) | Source (PRD/US) | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `proxy.ts` at the repo root shall `export default clerkMiddleware()` and `export const config = { matcher }` with Clerk's standard matcher (skips `_next` and static assets; includes `/(api\|trpc)(.*)` and `/__clerk/(.*)`); it shall contain no `createRouteMatcher`, no `auth.protect`, no redirect logic, and no `runtime` export. | must | security-model "Authentication", code-standards rule 7 | AC-001 |
| FR-002 | `app/layout.tsx` shall render `<ClerkProvider appearance={clerkAppearance}>` inside `<body>` wrapping F01's `Providers`; `lib/clerk-appearance.ts` shall use Clerk's dark base theme and map every colour/font/radius variable to a `var(--…)` token with no hex literal. | must | ui-context "Clerk components", reference 03-auth | AC-002, AC-003 |
| FR-003 | `app/(auth)/layout.tsx` shall render a two-panel layout at `≥ 1024px` (left: "drawArc" wordmark, tagline "Real-time collaborative system-design canvas.", three text-only feature lines; right: centred Clerk form) and form-only below; no gradients, images, cards, or scrolling hero. | must | reference 03-auth "Design" | AC-004 |
| FR-004 | `app/(auth)/sign-in/[[...sign-in]]/page.tsx` and `sign-up/[[...sign-up]]/page.tsx` shall render `<SignIn />` / `<SignUp />`; a signed-in visitor shall be redirected to `/editor` by an `auth()` read inside a Suspense child. | must | PRD-001, US-2, D-F02-8 | AC-005, AC-006 |
| FR-005 | `app/page.tsx` shall render a Suspense boundary whose child awaits `auth()` and calls `redirect('/editor')` when `userId` exists, else `redirect('/sign-in')`; no top-level await of request data. | must | reference 03-auth, code-standards rule 1 | AC-007 |
| FR-006 | `app/editor/page.tsx` shall wrap its content in `<Suspense fallback={<EditorHomeSkeleton/>}>` and call `requireUser({ unauthenticated: 'redirect' })` in the child; the resolved `AuthUser` shall be used only server-side; the navbar right slot shall render `<UserButton />` (editor home only). | must | PRD-001, US-6, code-standards rule 2 | AC-008, AC-009 |
| FR-007 | `lib/env.ts` shall make `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED` required and `lib/env.public.ts` shall make `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` required; `.env.example` shall document the Clerk redirect keys `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/editor`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/editor` (read by Clerk, not by `lib/env.ts`). | must | NFR-008, security-model "Secrets" | AC-010 |
| FR-008 | `prisma/schema.prisma` shall declare `generator client { provider = "prisma-client", output = "../lib/generated/prisma" }`, `datasource db { provider = "postgresql" }`, and model `User { id cuid @id, clerkId String @unique, email String @unique, name String?, avatarUrl String?, createdAt, updatedAt @updatedAt, deletedAt DateTime? }`; `prisma.config.ts` shall load `dotenv/config` and set `datasource.url` from `DATABASE_URL_UNPOOLED`; migration 1 shall create exactly this table. | must | PRD-002, domain-model "User", D-010, D-F02-1 | AC-011, AC-012 |
| FR-009 | `lib/prisma.ts` shall export a singleton `PrismaClient` using `PrismaNeon({ connectionString: env.DATABASE_URL })`, cached on `globalThis` outside production. | must | code-standards "Data access" | AC-013 |
| FR-010 | `lib/auth.ts` shall export `requireUser(opts?)` returning `{ user: AuthUser }`: `await auth()`; if no `userId` → `redirect('/sign-in')` (or `'/sign-in?redirect_url=…'` when `returnTo` given) in `'redirect'` mode, else throw `AccessError('UNAUTHENTICATED')`; load `User` by `clerkId`; if missing or `deletedAt` set → `currentUser()` once → `upsertUserFromClerk` → `bindPendingMemberships`; return the row mapped to `AuthUser`. `createRequireUser(deps)` shall accept injectable `{ auth, currentUser, db, bindPendingMemberships, logger }`. | must | PRD-002, PRD-011, US-5, D-F02-2/3/4 | AC-014, AC-015, AC-016, AC-017 |
| FR-011 | `lib/users.ts` shall export pure mappers `mapBackendUser(user)` and `mapWebhookUser(data)` → `ClerkUserInput { clerkId, email (lowercase primary), name (first+last → username → null), avatarUrl }` returning `null` when no email can be resolved; and DB helpers `upsertUserFromClerk(input)` (upsert by `clerkId`, sets `deletedAt: null`) and `markUserDeleted(clerkId)`. | must | domain-model invariants, data-ownership rule 5 | AC-018, AC-019 |
| FR-012 | `app/api/webhooks/clerk/route.ts` `POST` shall call `verifyWebhook(request)`; on failure respond 400 `{ error: { code: 'VALIDATION', message: 'Invalid webhook signature' } }` with no DB access; on `user.created`/`user.updated` upsert; on `user.deleted` set `deletedAt` (no-op if missing); other event types → 200 `{ ok: true, handled: false }`; successful handling → 200 `{ ok: true, handled: true }`; the handler shall be idempotent under replay and tolerant of reordering. | must | PRD-002, security-model "Clerk webhooks", US-6 | AC-020, AC-021, AC-022, AC-023 |
| FR-013 | `next.config.ts` shall add `images: { remotePatterns: [{ protocol: 'https', hostname: 'img.clerk.com', pathname: '/**' }] }` and change nothing else. | must | code-standards rule 9, reference bug §6 | AC-024 |
| FR-014 | No server module shall pass a Clerk `User` object (from `currentUser()`/`clerkClient`) or `AuthUser.clerkId`/`email` of *other* users to a client component; `AuthUser` is the only user shape crossing `lib/auth.ts`. | must | security-model "Clerk's full User object is never passed to the client" | AC-025 |
| FR-015 | `package.json` scripts shall add `db:generate` (`prisma generate`), `db:migrate` (`prisma migrate dev`), `db:deploy` (`prisma migrate deploy`), `postinstall` (`prisma generate`), and replace the F00 guard so `check` ends with the literal `prisma validate`. | must | testing-strategy "Quality gate", F00/D-F00-3 | AC-026 |
| FR-016 | Playwright global setup shall call `clerkSetup()` from `@clerk/testing/playwright`; specs shall call `setupClerkTestingToken({ page })` before sign-in; E2E users come from `E2E_USER_A_EMAIL/PASSWORD` (B reserved for F05+). | must | D-017, testing-strategy "E2E" | AC-027 |
| FR-017 | All new pages/handlers shall contain no `runtime`, `dynamic`, `revalidate`, `fetchCache`, `dynamicParams` exports and `npm run build` shall report no `blocking-prerender-*` insight. | must | code-standards rules 1–2, risk R-07 | AC-028 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | `requireUser()` is the only authentication read; pages/handlers call it first; webhook authenticates by signature. AUTHZ-MATRIX in `05-test-plan.md`. |
| NFR-002 | Webhook payloads are typed by `verifyWebhook` and additionally parsed with `ClerkWebhookUserSchema`/`ClerkDeletedSchema` (Zod) before use; `ClerkUserInputSchema` validates mapper output. |
| NFR-007 | Generated Prisma client typed; `AuthUser` interface; no `any`. |
| NFR-008 | Keys activated in `lib/env.ts`; `CLERK_SECRET_KEY` never imported client-side (`server-only`); CI sentinel check from F00 now exercises real keys. |
| NFR-009 | Webhook and `requireUser` log with `requestId` (from `svix-id` for webhooks), `clerkId`, `userId`. |
| NFR-010 | `prisma`, `@prisma/client`, `@prisma/adapter-neon` pinned `~7.10` (F00 pin test now non-vacuous). |

## UX and interaction behaviour

| Route | Unauthenticated | Authenticated |
|---|---|---|
| `/` | 307 → `/sign-in` | 307 → `/editor` |
| `/sign-in`, `/sign-up` | Clerk form inside the two-panel layout | 307 → `/editor` |
| `/editor` | 307 → `/sign-in` | shell + empty state + `UserButton` (avatar menu: manage account, sign out → Clerk returns to `/sign-in` via `afterSignOutUrl="/sign-in"`) |

Auth layout copy (PROPOSED): wordmark "drawArc"; tagline "Real-time collaborative system-design canvas."; features: "Node-and-edge architecture diagrams with live cursors", "Invite teammates by email as editors or viewers", "Autosaved projects you can reopen anywhere". Clerk form appearance: dark base theme, `colorPrimary` = brand, inputs on `--bg-elevated`, `borderRadius` `0.75rem`, font `var(--font-geist-sans)`. Skeleton for `/editor` fallback: navbar with a `h-8 w-8 rounded-full bg-subtle` avatar placeholder and the empty-state heading (static text, so `instant()` sees it).

Keyboard/a11y: Clerk components ship their own a11y; the auth layout's left panel is a `section` with `aria-labelledby` the wordmark; the `UserButton` wrapper keeps Clerk's trigger label.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Two parallel first requests for a new user (e.g. two tabs) | both call `upsert` by `clerkId`; exactly one row; both succeed (on `P2002` race the loser re-reads and returns the row) | AC-016 |
| EC-002 | Clerk session valid but `currentUser()` returns `null` (user deleted between calls) | `AccessError('UNAUTHENTICATED')` / redirect; nothing written | AC-015 |
| EC-003 | Clerk user has no primary email (instance misconfigured) | mapper returns `null`; `requireUser` throws `AppError('VALIDATION', 'Your account has no email address')` → `error.tsx`; webhook logs and returns 200 `handled: false` | AC-015, AC-022 |
| EC-004 | `user.updated` arrives before `user.created` (reordering) | both are upserts; final row reflects the last delivered payload | AC-021 |
| EC-005 | Same `svix-id` delivered twice (retry after timeout) | second upsert changes nothing (`updatedAt` may bump); 200 both times | AC-021 |
| EC-006 | `user.deleted` then a stale `user.updated` | `deletedAt` stays set because `upsertUserFromClerk` is only called by `requireUser` (valid session, D-F02-4) or by `user.created/updated` handlers which do **not** clear `deletedAt`; documented residual: stale name/avatar may land on a deleted row (harmless) | AC-021 |
| EC-007 | `user.updated` sets an email already owned by another `User` row (`P2002` on `email`) | log `error` with both `clerkId`s, respond 200 `handled: false` (D-F02-6); manual reconciliation | AC-023 |
| EC-008 | Database unreachable during webhook | 502 with `{ error: { code: 'UPSTREAM' } }` (the F00 status map; any non-2xx makes Svix retry); logged | AC-023 |
| EC-009 | Missing/garbled `svix-*` headers, wrong secret, body tampered | `verifyWebhook` throws → 400; DB untouched | AC-020 |
| EC-010 | Signed-in user opens `/sign-in` | redirected to `/editor` before the form streams (Suspense child) | AC-006 |
| EC-011 | `CLERK_WEBHOOK_SIGNING_SECRET` missing at boot | `lib/env.ts` fails fast naming the key (F00/EC-001) | AC-010 |
| EC-012 | Deep link `/editor/abc` while signed out (F04 route) | F04 passes `returnTo`; `requireUser` redirects to `/sign-in?redirect_url=%2Feditor%2Fabc`; verified here with a synthetic `returnTo` | AC-014 |
| EC-013 | `User.deletedAt` set but session valid (webhook raced a re-created account, or admin undo) | `requireUser` re-upserts from `currentUser()` clearing `deletedAt` (D-F02-4) | AC-017 |
| EC-014 | Clerk Backend API rate limit on `currentUser()` | only called when the row is missing/deleted (once per user lifetime); failure surfaces as `AppError('UPSTREAM')` → `error.tsx` retry | AC-015 |
| EC-015 | `img.clerk.com` avatar URL with query params (`?width=64`) | matched by `pathname: '/**'`; other hosts rejected by `next/image` (400) | AC-024 |
| EC-016 | Offline client on `/editor` | not applicable: pages are server-gated; client offline handling is F05 |— |
