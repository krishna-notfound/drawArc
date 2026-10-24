# drawArc — Decision Log

> One entry per significant product, architecture, or process decision. **APPROVED** = the owner said so on the date given. **PROPOSED** = recommended by planning, awaiting owner approval at Gate 5. **OPEN** = needs owner input. Never edit an approved entry; add a superseding one.

Format: ID · title · status · date · context · decision · alternatives considered · consequences · evidence.

---

### D-001 — drawArc is Ghost AI renamed; AI design agent and spec generation stay in the product
**APPROVED** 2026-10-22
- Context: `context/` held course material for "Ghost AI" (AI architecture generation + spec generation); the brief described an Excalidraw-style editor without AI.
- Decision: one product, named drawArc, including the collaborative editor, the AI design agent, and spec generation.
- Alternatives: (a) new product without AI; (b) editor now, AI as roadmap.
- Consequences: Trigger.dev and an LLM provider are core dependencies (M2/M3); canvas schema must be agent-writable; the reference feature prompts remain relevant.

### D-002 — Milestone-gated delivery: M1 editor + collaboration, M2 AI agent, M3 spec generation
**APPROVED** 2026-10-22
- Decision: all features are specified now; implementation proceeds M1 → M2 → M3; M2 starts only after the M1 acceptance run passes on a deployed environment and the owner approves.
- Alternatives: single MVP containing all four subsystems; AI-first.
- Consequences: canvas schema frozen at feature 06; AI specs reference the frozen schema; a usable release exists after M1.

### D-003 — Repository discovery baseline
**APPROVED (acknowledged)** 2026-10-22
- Facts: bare `create-next-app` scaffold (Next 16.4.2, React 19.3, Tailwind v4 via Turbopack loader), no planned libraries installed, no tests; `context/` was a byte-identical copy of the reference course context; uncommitted user edits to `app/page.tsx`, `app/layout.tsx`, `app/globals.css` and deleted `public/*.svg` are preserved.

### D-004 — Reference material is read-only
**APPROVED (implied by owner's naming)** 2026-10-22
- Decision: `No_touch_ai/` is never modified; it is cited as "reference" in specs; its `current-issues/*.md` bugs become acceptance criteria.

### D-005 — Tenancy: user-owned projects with per-project sharing; no Workspace entity
**APPROVED** 2026-10-22
- Decision: `Project.ownerId` + `ProjectMember(email, userId?, role editor|viewer)`. Roles resolved by one function.
- Alternatives: workspaces owning projects; personal + team workspaces.
- Consequences: single-level authz; Clerk Organizations unused; a future `Workspace` can be added as a parent of `Project` without breaking members.

### D-006 — LLM SDK choice deferred to M2 planning; only the agent contract is specified now
**APPROVED** 2026-10-22
- Alternatives considered: Anthropic SDK direct; Vercel AI SDK (`generateObject`/tools). The reference used Gemini via `@ai-sdk/google`.
- Consequences: feature 17 specifies `DesignAgentInput/Output` and the tool surface (`addNode`, `addEdge`, …) independent of SDK; the SDK decision is D-02x at M2.

### D-007 — Public share links are not in M1–M3; token model reserved
**APPROVED** 2026-10-22
- Decision: all access requires sign-in + membership. `ShareLink` is reserved in the domain model (not created). `getProjectRole` is the single extension point.
- Consequence: Liveblocks auth route has one path; no anonymous tokens.

### D-008 — Freehand drawing is out of MVP; roadmap as "stroke-as-node" (feature 21)
**APPROVED** 2026-10-22
- Evidence: React Flow has no non-node canvas primitive; xyflow's whiteboard guide recommends tldraw/Excalidraw for whiteboards; the documented path is perfect-freehand strokes rendered inside custom nodes.
- Consequence: `NodeShape` union may gain `'freehand'` in a future schema version; nothing in M1 depends on it.

### D-009 — Canvas snapshots and spec files are stored in Vercel Blob (private store); Postgres stores pointers
**APPROVED** 2026-10-22 (owner's choice, made twice — the second time with the cost/consistency evidence below)
- Decision: `canvas/{projectId}.json` overwritten in place; `specs/{projectId}/{specId}.md` immutable. Postgres holds `canvasBlobPath`, `canvasSavedAt`, `canvasSchemaVersion`, `ProjectSpec.blobPath`.
- Alternative recommended by planning: Postgres `jsonb` for snapshots (one transaction, no per-op billing, read-your-writes).
- Evidence (2026-10-22): Blob `access: 'private'` exists (store-level, SDK ≥ 2.3); private reads must be proxied (`get(pathname, { access: 'private' })`); advanced ops $5/1M, Hobby 2k advanced ops/month and 900/min; ≤ 60 s CDN stale window after overwrite unless `useCache: false`; server upload bound by 4.5 MB function body; no atomicity with the Postgres row.
- Consequences (binding mitigations): autosave debounce ≥ 30 s + flush on tab hide; server-side validation before `put`; `allowOverwrite: true`, `addRandomSuffix: false`, `useCache: false` on reads; pointer updated only after successful `put`; snapshot size cap 4 MB; non-atomic write recorded as risk R-04. Revisit if quota or staleness causes a verified defect.

### D-010 — Prisma 7 (pinned `~7.10`) with `@prisma/adapter-neon` on Neon
**APPROVED** 2026-10-22
- Alternative recommended by planning: Drizzle 0.45 (`neon-http`), because Prisma's npm `latest` is an 8.0 RC with a new migrate CLI and a 7.x-only Neon adapter.
- Consequences: pin `prisma`, `@prisma/client`, `@prisma/adapter-neon` to `~7.10`; `prisma.config.ts` with the **unpooled** URL for the CLI; `prisma-client` generator with explicit `output`; env not auto-loaded (`dotenv/config`); upgrade to Prisma 8 is a future task with its own migration-CLI change.

### D-011 — Local `User` table + email-keyed `ProjectMember` with lazy `userId` binding
**APPROVED** 2026-10-22
- Decision: `requireUser()` lazily upserts `User` from Clerk on first request; Clerk webhooks keep it current; invitations are by email; `userId` binds on first sign-in.
- Alternatives: no user table (reference pattern, Clerk Backend API per lookup); userId-only invites.
- Consequences: Liveblocks `userInfo` and the share dialog read from Postgres; webhook route is public and idempotent.

### D-012 — Real-time layer: Liveblocks Storage via `@liveblocks/react-flow`; Yjs not used
**PROPOSED** (library APPROVED by brief; mode PROPOSED)
- Evidence: `@liveblocks/react-flow` 3.24.4 is official, Storage-only, syncs position/width/height/data/handles/endpoints, local-only selection/drag/measured; server-side `mutateFlow` exists; viewport sync not documented.
- Consequence: one history, one snapshot, one server write path. Commits to the 10 MB/room Storage cap and the 10-connections/room plan limit (R-02).

### D-013 — Undo/redo is per-client via Liveblocks history; no custom history engine
**PROPOSED**
- Evidence: `useUndo` affects only the current client's operations; history is in-memory and cleared on reload; undo does not rebase and can overwrite a newer remote value (documented caveat).
- Alternatives: custom change-event history over `onNodesChange` (duplicates Liveblocks' and still cannot rebase); global undo (not supported).
- Consequences: PRD-027 wording ("the current user's own changes"); acceptance test documents the LWW outcome; agent writes (M2) are `origin: remote` and never in a user's stack.

### D-014 — Node `data` uses default deep sync; `label` is last-writer-wins per key
**PROPOSED**
- Context: two users typing in one label simultaneously is rare and the result (LWW on the string) converges. `LiveText` (beta) would give character-level merge but is beta and not supported by the React Flow package's `data` sync.
- Consequence: accepted for M1; revisit if user feedback shows label-clobbering.

### D-015 — Liveblocks authorization uses access tokens with permissions derived from Postgres roles; room id = projectId
**PROPOSED**
- Evidence: access-token mode ignores room-level `usersAccesses`; `['*:write']`/`['*:read']` replace deprecated `FULL_ACCESS`/`READ_ACCESS`; revocation requires a broadcast KICK because connected users are not disconnected and token TTL is unpublished.
- Alternative: ID tokens with room-level accesses (duplicates membership into Liveblocks).

### D-016 — Dark-only theme and the inherited token set
**PROPOSED** (inherited from the reference)
- Consequence: no light mode in M1–M3; tokens live in `globals.css`; palette ids in `types/canvas.ts`.

### D-017 — Test toolchain: Vitest 5 + Testing Library (L1/L2), Playwright + `@clerk/testing` + Liveblocks dev server (L3); no MSW in M1
**PROPOSED**
- Evidence: Next docs say async Server Components are not unit-testable; Liveblocks has an official Playwright guide using the local dev server; Vitest 5 needs Node ≥ 22.12; MSW 3 + Next 16 testmode compatibility unverified.
- Consequence: Node 22 pinned; `@types/node` bumped to `^22` (feature 00).

### D-018 — Server Actions for UI mutations; route handlers for Liveblocks auth, webhooks, snapshot/spec transfer, and Trigger.dev tokens
**PROPOSED**
- Rationale: Server Actions give single-round-trip revalidation (`updateTag`) and typed results for forms; route handlers are required where the caller is not our UI (Liveblocks client, Svix, Trigger.dev hooks) or the body is a file.

### D-019 — No third-party error-reporting SaaS in M1; structured logs to Vercel runtime logs
**OPEN** — owner to decide at Gate 5 (option: add Sentry in feature 15).

### D-020 — Canvas interaction defaults (loose connections, partial box-select, scroll-to-pan, custom delete handling, no post-drop fitView)
**PROPOSED** — evidence and rationale in `architecture-context.md` "Canvas architecture"; reference bugs (drop offset, auto-zoom on first drop, delete bypassing collaboration) become ACs in features 07 and 10.

### D-021 — Invitations grant access immediately with no email notification in M1
**PROPOSED** — the invitee sees the project under "Shared with me" after signing in with the invited email. Email delivery would require a mail provider (unjustified infrastructure for M1).

### D-022 — Blob reads use `useCache: false`; snapshot pathname deterministic; no versioned snapshots in Blob
**PROPOSED** — follows from D-009; version history relies on Liveblocks' built-in snapshots (24 h Free / 30 d Pro) until an export/version feature justifies more.

### D-023 — Dependency pins: `@xyflow/react ~12.12`, all `@liveblocks/*` exact single version, Prisma `~7.10`
**PROPOSED** — `13.0.0-next.0` and Prisma 8 RC exist without migration guides; adoption is a separate task.

### D-024 — No REST route handlers for project or member mutations in M1; Server Actions only
**PROPOSED** (F03) — all callers are our UI; route handlers remain only where the caller is not our UI or the body is a file. Diverges from the reference's REST routes. `architecture-context.md` updated.

### D-025 … D-033 — Feature-introduced decisions from F03, F04, F12
**PROPOSED** — numbered in those packages (`ProjectExternals` seam D-025, cache-tag scheme D-026, `useTransition` D-027, workspace slot contract D-028, `@axe-core/playwright` D-029, broadcast on every role change D-030, KICK → `client.logout()` + reload D-031, reconnect re-verification via `checkMyAccess` D-032, removal allowed on archived projects D-033). Full text in the respective `00-overview.md` / `02-design.md`.

### D-034 — Snapshot seeding is server-side (workspace gate + `mutateFlow`), not client-side
**PROPOSED** 2026-10-22 (Gate 4 audit) — Context: viewers hold read tokens and cannot seed; two editors opening an empty room simultaneously would race. Decision: the server gate reads the room with `getStorageDocument`; if empty and a snapshot exists, it validates, migrates, and seeds via `mutateFlow` before rendering. Consequence: one Liveblocks REST read per workspace open; F13 amended accordingly; `data-ownership.md` rule 3 updated.

### D-035 — Feature-local decision IDs
**PROPOSED** — Decisions introduced inside a feature package keep a feature-local id (`D-F00-1`, `P-05-2`, `D-07a`, `F17-D3` …) until Gate 5; on approval each is either copied here with a global `D-0xx` id or recorded as "approved within F<NN>". The index below lists where they live.

| Feature | Local decision ids | Location |
|---|---|---|
| F00–F02 | `D-F00-1…`, `D-F01-1…`, `D-F02-1…` | `features/0N-*/00-overview.md` |
| F03, F04, F12 | `D-024 … D-033` (global numbers, see above) | `features/03,04,12/*` |
| F05, F06, F11, F13 | `P-05-1…`, `P-06-1…`, `P-11-1…`, `P-13-1…` | `features/05,06,11,13/00-overview.md` |
| F07–F10, F14 | `D-07a…`, `D-08a…`, `D-09a…`, `D-10a…`, `D-14a…` | `features/07–10,14/00-overview.md` |
| F15–F18 | `F15-D1…`, `F16-D1…`, `F17-D1…`, `F18-D1…` | `features/15–18/00-overview.md` |

### D-036 — `lib/errors.ts` (AccessError, ActionResult, ErrorCode) is owned by F00; `VALIDATION` maps to 400 by default, 422 on explicit override
**PROPOSED** — resolves the 400/422 inconsistency found at Gate 4; `code-standards.md` updated.

### D-037 — AI accent utilities renamed `bg-ai` / `text-ai-text`; muted/faint text tokens are decorative-only
**PROPOSED** — avoids collision with shadcn's `accent` token; records the contrast shortfall against NFR-006. `ui-context.md` updated.

---

### D-038 — F00 approved, including its local decisions D-F00-1 … D-F00-8
**APPROVED** 2026-10-23 (owner approved feature 00) — env keys optional until activated by their feature; `lib/env.ts` / `lib/env.public.ts` split; guarded `prisma validate`; `lib/errors.ts` per D-036; stdout/stderr logger; unstyled error pages until F01; Zod `^4`; Playwright `webServer` dev locally / start in CI. Recorded as "approved within F00" per D-035.

---

### D-039 — F01 approved, including D-F01-1 … D-F01-8 and D-F01-2a
**APPROVED** 2026-10-23 (owner approved feature 01 as written) — React Flow stylesheet + `@xyflow/react ~12.12` installed in F01; shared `SidebarPanel`; sidebars closed by default; placeholder `/editor`; z-index scale; layout.tsx metadata/body classes only; `AppDialog`/`ConfirmDialog`; `--accent-ai-foreground` white on `bg-ai`. Recorded as "approved within F01" per D-035.

### D-040 — Development workflow: feature branch per phase off `main`, PR to GitHub `krishna-notfound/drawArc` (public), fresh planner/implementer/reviewer agents per phase, 4–5 commits per phase
**APPROVED** 2026-10-23 (owner). Default branch renamed `master` → `main`. Commits authored `krishna <krishnagtkr@gmail.com>` (owner-confirmed GitHub email). Stacked branches allowed while a predecessor PR is open.

---

### D-041 — F01 review fixes approved: `--background-color-base`, `cn` dependency, commit owner's home page
**APPROVED** 2026-10-23 (owner) — (1) The base background token is registered as `--background-color-base` instead of `--color-base`: in Tailwind v4 `--color-base` also generates `text-base` as a colour, which overrode the `text-base` font size and made shadcn Input/Textarea text invisible (found by the F01 final review in the built CSS). AC-002 and 02-design amended. (2) `cn` (shadcn's first-party class merger, `shadcn-ui/cn`) is an approved dependency because shadcn 4.22 registry components import it; `lib/utils.ts` re-exports it so one engine ships. (3) The owner's uncommitted `app/page.tsx` edit and staged `public/*.svg` deletions are committed with F01, because the committed create-next-app page violated F01's no-raw-colour rule in clean checkouts/CI.

---

### D-042 — F02 approved; first migration on Neon `development` only; lean testing policy
**APPROVED** 2026-10-23 (owner: "go for it … move to next phase"). F00 (PR #1) and F01 (PR #2) merged to `main` with merge commits. F02 spec approved with its local decisions; the Prisma migration for `User` may be applied to the Neon `development` branch only (never `production`). Testing policy (owner): only meaningful behaviour/risk tests — no per-line or trivial tests; an AC may be verified by build, type-check, lint, or inspection when a test adds nothing; record which.

---

### D-043 — Deleted accounts: soft-delete kept, email held for 15 days, then released; no cron
**APPROVED** 2026-10-24 (owner). Purpose: stop users resetting a free trial or other per-account benefits by deleting and re-creating an account with the same email. On `user.deleted` the row is soft-deleted and keeps its email. A new account with that email is refused while `now - deletedAt < 15 days` (specific "recently deleted" screen with the date it becomes available); after 15 days the old row's email is released (`deleted+<userId>@invalid`) and the new account proceeds. Enforced by comparing `deletedAt` with the current date at request/webhook time — no scheduled job. A `user.deleted` for an unknown `clerkId` writes a tombstone so a late `user.created` cannot create a live row. F02 FR-018 / AC-035–036 added. Supersedes the "manual reconciliation" handling for this case.

---

### D-044 — Parallel feature rounds adopted; F04 and F05 approved together
**APPROVED** 2026-10-24 (owner: "move for further dev if it can be parallel"). Features with no dependency on each other are built concurrently by separate implementation agents, each in its own git worktree and branch, with a distinct Playwright port (`E2E_PORT`) and integration-test schema. Rounds (from features/README.md): R2 F04 ∥ F05 · R3 F06 ∥ F12 · R4 F07 ∥ F11 ∥ F13 · R5 F08 ∥ F09 · R6 F10 ∥ F14 · R7 F15. The coordinator merges each round in order, resolves conflicts, and re-runs the full gate before the next round. F04 and F05 specs approved with their local decisions; F05 adds no database migration.

---

### D-045 — Round 3: F06 and F12 approved; Clerk dev test user B
**APPROVED** 2026-10-24 (owner: "proceed"). F06 (canvas schema v1 frozen on merge) and F12 approved with their local decisions; a second Clerk development-instance test user drawarc-e2e-b+clerk_test@example.com created for two-user tests (credentials only in .env.local).

---

### D-046 — Round 4: F07, F11, F13 approved; F13 sequenced after F07+F11; private Blob store created
**APPROVED** 2026-10-24 (owner chose "F07 + F11 now, F13 right after"). F07 and F11 built in parallel; F13 starts after they merge (memory headroom). Vercel Blob store `drawarc-blob` (id `store_L1dpXXVFhT6P36T3`, access private, region `sin1`, personal account) created via the Vercel MCP; its `BLOB_READ_WRITE_TOKEN` is copied by the owner from the dashboard into `.env.local` only. No Vercel project created yet (F15).

---

### D-047 — Vercel home for drawArc: team personal_project; project `drawarc`; Blob store via CLI
**APPROVED** 2026-10-24 (owner chose "personal_project (CLI account) — automate it"). The Blob store created earlier through the Vercel MCP (`store_L1dpXXVFhT6P36T3`) turned out to belong to a different Vercel account than the local CLI login, and its token is not exposed via API; it is left unused (owner may delete). New private store `drawarc-blob` (`store_MqpS4uODwS26iU1T`, sin1) created with the Vercel CLI under team personal_project and linked to the new Vercel project `drawarc`; `BLOB_READ_WRITE_TOKEN` pulled into `.env.local` by `vercel env pull`. `vercel link` auto-connected the GitHub repo — disconnected immediately so pushes do not deploy before F15. Supersedes the store details in D-046.

---

## Open decisions requiring owner input (Gate 5)

| ID | Question | Recommendation |
|---|---|---|
| D-019 | Error-reporting SaaS in M1? | No; add in feature 15 only if Vercel logs prove insufficient |
| O-1 | Should M1 include the right-click context menu and shortcut cheat-sheet (feature 10), or defer to post-M1 polish? | Include; low cost, high usability |
| O-2 | Liveblocks plan for development: Free is non-commercial only; is drawArc commercial? | Pro ($30/mo) before any public deployment |
| O-3 | Project "slug" in URLs (reference had a slug preview) vs cuid only? | cuid only; slugs add a uniqueness/rename problem for no M1 value |
| O-4 | Archive state: keep `ARCHIVED` in M1 or drop to `ACTIVE` only? | Keep; one enum value, enables soft-delete UX |
