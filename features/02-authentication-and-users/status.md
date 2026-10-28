# F02 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and independently verified; PR open, awaiting merge |
| Spec approved | 2026-10-23, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-23, owner — one implementation agent; first Prisma migration authorized on the Neon `development` branch ONLY |
| Last verified | 2026-10-24, commit `fa0c580` on `feat/f02-authentication-and-users` |

## History
- 2026-10-22 — drafted by planning session (Gate 3).
- 2026-10-22 — Gate 4 audit fixes applied: webhook DB-failure status 502 `UPSTREAM` (code map), six two-layer ACs split (AC-002b, AC-007b, AC-011b, AC-024b, AC-026b; AC-029 now L2 only), migration ownership statement. See `features/AUDIT-2026-10-22.md`.

- 2026-10-23/24 — Implemented by implementation agent in 5 commits (`506989f..4acd236`); fresh review: no Critical; Important = deleted account's email locks out re-registration and out-of-order delete. Owner decision D-043 (15-day email hold, no cron); fix commit `fa0c580` (+ returnTo hardening, `@clerk/ui` pinned).
## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `506989f` env activation + Prisma 7 + `User` model/migration · `d1c5412` Clerk proxy, themed provider, sign-in/up pages · `e0bf9cd` requireUser, user sync, signed webhook · `bd7c731` /editor gate, UserButton, auth e2e · `4acd236` hydration-safe UserButton slot · `fa0c580` 15-day email hold (D-043), returnTo hardening, `@clerk/ui` pin.

Independent verification (main session, 2026-10-24):

| Check | Result |
|---|---|
| `npm run check` | exit 0 — 275/275 tests (integration tests against Neon `development` throwaway schema); `prisma validate` OK |
| `npm run build` | exit 0 — `◐ /`, `◐ /editor`, `◐ /sign-in`, `◐ /sign-up` (partial prerender), `ƒ /api/webhooks/clerk`, `○ /_not-found` |
| `npm run e2e` | 25 passed (real Clerk sign-in with test user) |
| Clean clone, no `.env.local` | `npm ci`, `npm run check` (DB tests skip), `npm run build` with CI env, `check:bundle` (9 sentinels, none found) all pass |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Neon | migration `20261023230459_user` applied to `development` only; `production` public tables = 0 |

External changes made (authorized): migration on Neon `development`; throwaway schema `f02_l2_test` on `development` (droppable); Clerk dev-instance test user `drawarc-e2e-a+clerk_test@example.com` (credentials in `.env.local`).

Versions: @clerk/nextjs 7.9.20, @clerk/ui 1.41.2 (`~`), @clerk/testing 2.2.50, prisma/@prisma/client/@prisma/adapter-neon 7.10.1 (`~7.10`), @neondatabase/serverless 1.2.0, svix 2.8.0, dotenv 18.0.9.

Notable rulings: Clerk theme from `@clerk/ui/themes`; migration generated offline + `migrate deploy` (no shadow DB on shared branch); /editor gates only the navbar user slot + body via one cached auth check (whole-page boundary caused focus loss/hydration error); sign-in e2e enters code 424242 (instance requires email code on new devices); redirects stream (200 + client navigation) under Cache Components instead of 307; Playwright capped at 4 workers; malformed webhook payload → 200 `invalid-payload`; CI builds with placeholder publishable key; `EmailHeldError` (403 `recently-deleted`, `availableAt`); events for deleted rows are ignored; tombstone = deleted row with `deleted+<clerkId>@invalid`.


## Open issues
- D-F02-1 schema split (F02: Prisma setup + `User` + migration 1; F03: `Project`/`ProjectMember` + migration 2; F17 migration 3; F18 migration 4) — confirmed consistent across packages at Gate 4; owner to approve. Each migration requires its own authorization.
- D-F02-7: `app/page.tsx` (owner's "ghost ai" placeholder) is replaced by the redirect page — the only owner edit F02 overwrites.
- D-F02-2/D-F02-3/D-F02-4/D-F02-5/D-F02-6/D-F02-8 await owner confirmation (see `00-overview.md`).
- Cross-feature obligation: security-model says a deleted user's memberships are removed; `ProjectMember` does not exist in F02, so the webhook only sets `deletedAt`. F03/F12 must add the removal (tracked here until picked up).
- UNVERIFIED (resolved at T-002/T-007/T-008): Clerk 7.9 dark-theme package and appearance variable names; `ClerkProvider` prerender behaviour; Prisma `upsert` atomicity; `svix` signer compatibility for L2.
- Prerequisites not performed by this feature: Neon project/branches, Clerk dev instance + webhook + test users, GitHub repository secrets for L2/L3 in CI (F15 schedules CI E2E).
- Owner action: `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.local` is a local placeholder — register the Clerk webhook endpoint (needs a public URL, i.e. after deployment in F15) and set the real secret; until then real deliveries get 400.
- CI has no database or Clerk secrets: integration (L2) and e2e (L3) tests run locally only. Adding CI secrets is a separate owner decision.
- Live email swap between two active accounts may leave a stale email until the next Clerk update (EC-007, accepted); F03 binding by email should be aware.
- Removal of a deleted user's memberships is owed by F03/F12.
- 2026-10-28 — FR-003/004/005/006 superseded by D-052/D-062/D-064: `/` is the F26 landing page; custom auth UI is F27.
