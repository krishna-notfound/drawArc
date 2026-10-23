# drawArc

drawArc is a real-time collaborative system-design canvas. A project owner creates a diagram, invites teammates by email, and everyone edits the same node-and-edge architecture diagram at once with live cursors. An AI design agent can draft or extend the architecture from a plain-English prompt, and the finished graph can be turned into a Markdown technical specification. (drawArc was formerly named Ghost AI; the repository name `ghost_ai` keeps the former name.)

Built with Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4, React Flow, Liveblocks, Clerk, Neon Postgres with Prisma, Vercel Blob, and Trigger.dev. Each service is added by the feature that needs it; see the feature specifications below.

## Prerequisites

- Node.js 22.12 or later (`.nvmrc` pins 22; the supported range is `>=22.12 <25`).
- npm (the repository uses `package-lock.json`).

## Setup

```bash
npm ci
cp .env.example .env.local   # every key is optional until the feature named in its comment activates it
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
| `check` | The quality gate: route types + typecheck, lint, unit tests, Prisma schema validation |
| `check:bundle` | After a build, fail if a sentinel server secret appears in `.next/static` |
| `e2e` | End-to-end tests (Playwright; starts the dev server) |
| `e2e:install` | Download the Chromium browser Playwright uses |

`npm run check` must pass before any task is reported complete. CI (`.github/workflows/ci.yml`) runs `check`, `build`, `check:bundle`, and `npm audit --audit-level=high`.

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
