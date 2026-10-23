# drawArc

drawArc is a real-time collaborative system-design canvas. A project owner creates a diagram, invites teammates by email, and everyone edits the same node-and-edge architecture diagram at once with live cursors. An AI design agent can draft or extend the architecture from a plain-English prompt, and the finished graph can be turned into a Markdown technical specification. (drawArc was formerly named Ghost AI; the repository name `ghost_ai` keeps the former name.)

Built with Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4, React Flow, Liveblocks, Clerk, Neon Postgres with Prisma, Vercel Blob, and Trigger.dev. Each service is added by the feature that needs it; see the feature specifications below.

## Prerequisites

- Node.js 22.12 or later (`.nvmrc` pins 22; the supported range is `>=22.12 <25`).
- npm (the repository uses `package-lock.json`).

## Setup

```bash
npm ci                       # also generates the Prisma client (postinstall)
cp .env.example .env.local   # fill in the keys marked "required" (database and Clerk); see Authentication setup
npm run db:deploy            # apply migrations to the database in DATABASE_URL_UNPOOLED
npm run dev                  # http://localhost:3000
```

Environment variables are validated at startup by `lib/env.ts` (server) and `lib/env.public.ts` (browser-safe `NEXT_PUBLIC_*` keys). Never commit `.env.local`.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Start the development server |
| `build` | Production build |
| `start` | Serve the production build |
| `lint` | ESLint (flat config; enforces the Cache Components and env-access rules) |
| `typecheck` | Generate Next.js route types (`next typegen`), then `tsc --noEmit` |
| `test` | Unit tests once (Vitest) |
| `test:watch` | Unit tests in watch mode |
| `check` | The quality gate: route types + typecheck, lint, unit and integration tests, `prisma validate` |
| `check:bundle` | After a build, fail if a sentinel server secret appears in `.next/static` |
| `e2e` | End-to-end tests (Playwright; starts the dev server) |
| `e2e:install` | Download the Chromium browser Playwright uses |
| `postinstall` | Runs `prisma generate` after every install (the client lives in git-ignored `lib/generated/prisma`) |
| `db:generate` | Regenerate the Prisma client after editing `prisma/schema.prisma` |
| `db:migrate` | Create and apply a migration on a development database (`prisma migrate dev`) |
| `db:deploy` | Apply committed migrations (`prisma migrate deploy`) |

`npm run check` must pass before any task is reported complete. CI (`.github/workflows/ci.yml`) runs `check`, `build`, `check:bundle`, and `npm audit --audit-level=high`.

## Authentication setup

drawArc signs users in with Clerk and keeps a local `User` row in Neon Postgres (Prisma 7).

1. **Clerk** (development instance): enable Email + Password and "require email address". Copy the publishable and secret keys into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, and keep the four `NEXT_PUBLIC_CLERK_*_URL` routing keys from `.env.example`.
2. **Webhook**: in the Clerk dashboard add an endpoint `https://<host>/api/webhooks/clerk` subscribed to `user.created`, `user.updated` and `user.deleted`, and put its signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`. Locally, a tunnel (for example ngrok) is needed for real deliveries; without one, any `whsec_` value lets the app boot, and the local `User` row is still created on first sign-in.
3. **Database**: `DATABASE_URL` is Neon's pooled connection string (runtime), `DATABASE_URL_UNPOOLED` the direct one (Prisma CLI). Run `npm run db:deploy` to apply migrations.
4. **Tests**: integration tests (`tests/integration`) run against `DATABASE_URL_TEST` — a direct Neon URL, optionally with `schema=<name>` to isolate the suite — and skip when it is unset. End-to-end tests sign in a Clerk test user from `E2E_USER_A_EMAIL` / `E2E_USER_A_PASSWORD` (use a `+clerk_test` address; its verification code is `424242`).

Every page, route handler and Server Action authenticates by calling `requireUser()` from `lib/auth.ts` first; `proxy.ts` only establishes the Clerk session.

## How this project is planned

drawArc is built with specification-driven development and human approval gates.

- `CLAUDE.md` — entry point and rules for AI-assisted sessions.
- `context/README.md` — index of the project context: product, architecture, data ownership, security, UI, code standards, testing, decisions, progress.
- `features/README.md` — the numbered feature specifications in dependency order, each with requirements, acceptance criteria, and a test plan.
- `docs/superpowers/plans/` — implementation plans for approved features.

`No_touch_ai/` is read-only reference material from the course drawArc was derived from. Do not modify it.

## Troubleshooting

- **Playwright cannot start the server / port 3000 in use:** locally, Playwright reuses a server already running on port 3000; stop other processes on that port or start `npm run dev` yourself first. In CI the port must be free.
- **`Invalid environment (server): KEY (code)` at startup:** a key in `.env.local` has the wrong format (for example a Clerk secret that does not start with `sk_`). The message names the key, never its value.
