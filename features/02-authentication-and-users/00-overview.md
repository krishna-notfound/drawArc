# F02 — Authentication and Users

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F01 (shell, tokens, `navbarRight` slot, `app/providers.tsx`), F00 (`lib/env.ts`, `lib/errors.ts`, `lib/logger.ts`, test harness) |
| Depended on by | F03 (`requireUser()`, `AuthUser`, Prisma `User` model, `prisma.config.ts`, `lib/prisma.ts`, migration 1), F04 (gated pages), F05 (`requireUser` in Liveblocks auth), F12 (email-bound membership) |
| Product requirements | PRD-001, PRD-002, PRD-011 (the sign-up half; the invite half is F12) |
| Status | see status.md |

## Purpose

F02 makes drawArc know who the user is. It installs Clerk (`@clerk/nextjs` 7.9.x) under the Next.js 16 rules — `proxy.ts` with `clerkMiddleware()` and no routing decisions, auth reads inside Suspense children — and introduces the first Postgres table: the local `User` projection that every later feature joins against. It provides `requireUser()`, the single entry point every page, route handler, and Server Action calls first, which lazily creates the `User` row and binds pending memberships by email; and the Clerk webhook that keeps the row current. It sits after F01 so the sign-in pages and `UserButton` land in the styled shell, and before F03 because projects need an owner id.

## Problem statement and goals

- Problem: without a local identity row, membership by email (D-011) and Liveblocks `userInfo` would require Clerk Backend API calls per lookup; without a single `requireUser()`, authorization would be re-implemented per route (NFR-001 violation); without Cache Components discipline, the first auth page breaks the build (risk R-07).
- G-1: A visitor can sign up / sign in with Clerk; `/` sends authenticated users to `/editor` and others to `/sign-in`; `/editor` is gated server-side.
- G-2: The first authenticated request creates the `User` row; webhooks keep `email/name/avatarUrl` current and mark deletions; both paths are idempotent and order-tolerant.
- G-3: `requireUser()` has one behaviour contract (redirect for pages, `AccessError('UNAUTHENTICATED')` for handlers/actions) and an injectable Clerk seam so L1/L2 tests never mock SDK internals.
- G-4: `npm run build` passes with no `blocking-prerender-*` insight on `/`, `/sign-in`, `/sign-up`, `/editor`.

## Scope

In scope:
- `@clerk/nextjs ~7.9`, `proxy.ts` (`export default clerkMiddleware()` + standard matcher; **no** `createRouteMatcher`, no `auth.protect()` in proxy).
- `ClerkProvider` inside `<body>` with the dark base theme and appearance variables mapped to tokens (`lib/clerk-appearance.ts`).
- `app/(auth)/layout.tsx` two-panel layout; `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`; signed-in visitors to these pages are redirected to `/editor`.
- `app/page.tsx` → redirect by session (auth read in a Suspense child); `app/editor/page.tsx` gated via `requireUser({ unauthenticated: 'redirect' })` in a Suspense child; `UserButton` in the navbar right slot (editor home only).
- Prisma 7 (`~7.10`) + `@prisma/adapter-neon` + `prisma.config.ts` + `lib/prisma.ts`; `prisma/schema.prisma` with the `User` model per domain-model.md; **migration 1** (`user`).
- `lib/auth.ts`: `requireUser()`, `AuthUser`, `createRequireUser(deps)` seam; `lib/users.ts`: `mapBackendUser`, `mapWebhookUser`, `upsertUserFromClerk`, `markUserDeleted`, `bindPendingMemberships` (no-op stub, body supplied by F03).
- `app/api/webhooks/clerk/route.ts` with `verifyWebhook`, idempotent handling of `user.created|updated|deleted`, 400 on bad signature.
- `next.config.ts` `images.remotePatterns` for `https://img.clerk.com/**`; `lib/env.ts` activation of Clerk and database keys; `.env.example` updates; `scripts/check-prisma.mjs` guard replaced by literal `prisma validate`.
- Playwright `clerkSetup()` in the F00 global setup; `tests/factories.ts` `makeUser`; E2E sign-in with `@clerk/testing`.

Out of scope / non-goals:
- `Project`/`ProjectMember` tables, `getProjectRole`, the body of `bindPendingMemberships` (F03). Membership removal on `user.deleted` (F03/F12 — the table does not exist yet; recorded as a cross-feature obligation). Liveblocks `userInfo` (F05). Workspace navbar variant without `UserButton` (F04). Clerk Organizations (never, D-005). Public routes beyond `/`, `/sign-in/*`, `/sign-up/*`, `/api/webhooks/*` (F20 future). Invitation emails (D-021). Dashboard work in Clerk/Neon/Vercel (separately authorized prerequisites, listed in `04-implementation-plan.md`). Custom sign-in UI (Clerk components are used as-is).

## User stories

- US-1: As a visitor, I want to sign up or sign in so that I can reach the editor.
- US-2: As a signed-in user, I want `/` to take me to `/editor` and sign-in pages to skip themselves so that I never see a login form while authenticated.
- US-3: As a signed-in user, I want my name and avatar to follow my Clerk profile so that collaborators recognise me.
- US-4: As an invitee who signs up with the invited email, I want to see the shared project without any extra step (F03 completes the binding; F02 guarantees the hook runs on first sign-in).
- US-5: As a developer, I want `requireUser()` to be the only way to learn who the caller is so that authorization is uniform.
- US-6 (abuse): As an anonymous caller I must not reach `/editor` or receive any user data; as an attacker posting to the webhook without a valid Svix signature I must get 400 and cause no side effects; as a client I must never receive Clerk's full `User` object.

## Key decisions referenced

- D-011 (local `User` + lazy binding), D-010 (Prisma 7 pin), D-017 (`@clerk/testing`), D-018 (route handlers for webhooks), security-model "Authentication (Clerk)", code-standards Next 16 rules 1, 2, 5, 7, 9.
- PROPOSED D-F02-1: **Schema split** — F02 owns `prisma/schema.prisma` creation, `prisma.config.ts`, `lib/prisma.ts`, the `User` model and migration 1; F03 adds `Project`/`ProjectMember` as migration 2. Each migration is a separately authorized step (ai-workflow-rules). Rationale: F02 needs a persisted user id; F03's package already assumes this split.
- PROPOSED D-F02-2: `requireUser(opts?: { unauthenticated?: 'throw' | 'redirect'; returnTo?: string })` — default `'throw'` (`AccessError('UNAUTHENTICATED')`, mapped to 401 by `errorResponse` and to `{ ok: false }` by actions); pages pass `'redirect'`. One function, as the context files name it.
- PROPOSED D-F02-3: `bindPendingMemberships(user)` is called by `requireUser()` and by the webhook upsert, ships as a no-op returning `{ bound: 0 }` in F02, and F03 supplies the body (F03/FR-00x). The call contract is tested now.
- PROPOSED D-F02-4: A `User` row with `deletedAt` set whose Clerk session is nevertheless valid is resurrected (`deletedAt: null`) by `requireUser()` — Clerk is authoritative for identity.
- PROPOSED D-F02-5: `requireUser()` is **not** a `'use cache: private'` function (it has side effects). A read-only cached `getCurrentUser()` per code-standards rule 3 is added by F04 if page composition needs it.
- PROPOSED D-F02-6: Email-uniqueness conflicts in the webhook (`P2002` on `email`) are logged at `error` and answered 200 (retrying cannot fix them); all other DB failures return 500 so Svix retries.
- PROPOSED D-F02-7: `app/page.tsx` (owner's "ghost ai" placeholder) is replaced by the redirect page — this is the one owner edit F02 overwrites; stated for approval.
- PROPOSED D-F02-8: The sign-in/sign-up pages perform their own "already signed in → `/editor`" redirect in a Suspense child rather than relying on Clerk component behaviour (UNVERIFIED for 7.9).

## Reference material

- `context/security-model.md` (Authentication, Secrets), `context/domain-model.md` (User), `context/data-ownership.md` (Identity row), `context/code-standards.md` (Next 16 rules), `context/testing-strategy.md` (seam rule, E2E users).
- Research `scratchpad/research/services.md` §A (Clerk 7.9.19, `proxy.ts`, `auth()`, `currentUser()`, webhooks via Svix, `verifyWebhook`, `img.clerk.com`, `@clerk/testing` 2.2.49) and §B (Prisma 7 / Neon), `scratchpad/research/nextjs-testing.md` (auth-with-Cache-Components pattern, `remotePatterns`), all checked 2026-10-22.
- Reference prompt `No_touch_ai/.../feature-specs/03-auth.md` (two-panel layout, `UserButton` placement, `/` redirect — product intent only; its `@clerk/ui` dependency and "protect everything else in proxy" are superseded by our decisions). Reference bug `current-issues-workspace-implementation.md` §6–7 (`img.clerk.com` allow-list; `UserButton` only on editor home).
