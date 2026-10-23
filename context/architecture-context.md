# drawArc — Architecture Context

> Stack choices marked APPROVED were set by the owner's brief or explicit answers (2026-10-22). Structure, boundaries, and library usage patterns are PROPOSED. Library facts are VERIFIED against official docs on 2026-10-22 (versions below); re-verify after upgrades.

## Stack

| Layer | Technology | Version (verified 2026-10-22) | Status | Role |
|---|---|---|---|---|
| Framework | Next.js App Router, React, TypeScript | 16.4.2 / 19.3.0 / 5.x (installed) | APPROVED | Full-stack app; Cache Components model |
| Styling / UI | Tailwind v4 (Turbopack loader), shadcn/ui, lucide-react | installed / to add | APPROVED | Tokens + accessible primitives |
| Canvas | `@xyflow/react` | **12.12.0** (pin `~12.12`; `13.0.0-next.0` exists, no migration guide) | APPROVED lib, PROPOSED pin | Node/edge editor |
| Real-time | `@liveblocks/client` `react` `react-ui` `react-flow` `node` | **3.24.4** (all on one version) | APPROVED lib | Storage-backed sync, presence, history, server-side mutation |
| Auth | `@clerk/nextjs` | **7.9.19** | APPROVED | Identity, sessions, webhooks |
| Database | Neon Postgres + Prisma | Prisma **7.10.1** pinned (`prisma`, `@prisma/client`, `@prisma/adapter-neon` all `~7.10`) | APPROVED (D-010) | Durable relational data |
| Artifact store | Vercel Blob (private store) | `@vercel/blob` **2.8.2** | APPROVED (D-009) | Canvas snapshots, spec Markdown |
| Background jobs | Trigger.dev | `@trigger.dev/sdk` **4.7.7** | APPROVED for M2/M3 only | AI agent, spec generation |
| LLM SDK | deferred | — | APPROVED deferral (D-006) | Decided at M2 planning |
| Validation | Zod | 3.x/4.x (to pin) | PROPOSED | All boundaries |
| Tests | Vitest 5, Testing Library, Playwright 1.64, `@clerk/testing`, Liveblocks dev server | see testing-strategy | PROPOSED | See [testing-strategy.md](testing-strategy.md) |
| Hosting | Vercel + Neon Vercel integration (preview branches) | — | PROPOSED | Deploy per PR |

Not used: Clerk Organizations, Yjs (`@liveblocks/react-flow` is Storage-only), Vercel KV/Edge Config, a separate API server.

## System diagram

```
┌──────────────── Browser (Client Components) ────────────────┐
│  Editor shell ── ReactFlow ◄── useLiveblocksFlow ◄──┐        │
│  Sidebars, dialogs, AI chat                          │ WS    │
│  Clerk <ClerkProvider>                               │        │
└───────────────┬───────────────────────┬──────────────┼────────┘
                │ RSC / Server Actions  │ Route Handlers│
┌───────────────▼───────────────────────▼──────────────▼────────┐
│  Next.js server (Vercel, Node runtime)                        │
│  proxy.ts (Clerk session)    lib/auth  lib/access  lib/env    │
│  app/api/liveblocks-auth     app/api/webhooks/{clerk,liveblocks}
│  app/editor/actions.ts  api/projects/[id]/canvas  api/ai/* (M2)│
└───┬───────────────┬──────────────────┬─────────────────┬──────┘
    │ Prisma        │ @liveblocks/node │ @vercel/blob    │ tasks.trigger
┌───▼────┐   ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼───────┐
│  Neon  │   │ Liveblocks  │   │ Vercel Blob  │   │ Trigger.dev  │
│Postgres│   │ Storage/    │   │ (private)    │   │ runs → LLM   │
│        │   │ Presence    │◄──┼──────────────┼───┤ mutateFlow   │
└────────┘   └─────────────┘   └──────────────┘   └──────────────┘
```

Dependency direction: `app/` → `components/` → `lib/` → external SDKs. `lib/` never imports from `app/` or `components/`. `trigger/` imports only from `lib/` and `types/`.

## Directory layout (PROPOSED)

```
app/
  (auth)/sign-in/[[...sign-in]]/page.tsx     Clerk pages
  (auth)/sign-up/[[...sign-up]]/page.tsx
  editor/page.tsx                            editor home (server)
  editor/[projectId]/page.tsx                workspace (server gate → client editor)
  api/liveblocks-auth/route.ts
  api/webhooks/clerk/route.ts
  api/webhooks/liveblocks/route.ts
  editor/actions.ts                          Server Actions: project + member mutations (D-024: no REST routes for these)
  api/users/resolve/route.ts                 resolveUsers for Liveblocks (F05)
  api/projects/[projectId]/canvas/route.ts   snapshot PUT/GET
  api/ai/design/route.ts, api/ai/design/token/route.ts   (M2)
  api/ai/spec/route.ts, api/projects/[projectId]/specs/* (M3)
  layout.tsx, globals.css, error.tsx, not-found.tsx
components/
  ui/            shadcn (generated; do not edit)
  editor/        navbar, sidebars, dialogs, access-denied
  canvas/        flow wrapper, nodes/, edges/, palette, toolbars, cursors
  ai/            sidebar, chat, specs (M2/M3)
lib/
  env.ts         Zod-validated process.env (server-only import)
  env.public.ts  Zod-validated NEXT_PUBLIC_* (client-safe)
  errors.ts      AccessError, ActionResult<T>, ErrorCode union, HTTP mapping (owned by F00)
  prisma.ts      cached client with PrismaNeon adapter
  auth.ts        requireUser(): Clerk auth() + lazy User upsert
  access.ts      getProjectRole(), requireProjectRole()
  liveblocks.ts  cached Liveblocks node client
  blob.ts        snapshot/spec read+write helpers (private store)
  canvas/        schema.ts (Zod + migrations), serialize.ts (strip runtime fields), templates.ts
  logger.ts      structured logging
prisma/
  schema.prisma, migrations/, prisma.config.ts (root)
trigger/         design-agent.ts, generate-spec.ts (M2/M3)
types/           canvas.ts (CanvasNode/Edge/Document), liveblocks.config.ts (global Liveblocks types)
hooks/           useAutosave, useKeyboardShortcuts, useProjectDialogs, …
proxy.ts         Clerk clerkMiddleware()
tests/           unit/ (Vitest), e2e/ (Playwright)
```

## Server / client responsibilities

- **Server Components** render pages, perform the access gate, and pass minimal props (`projectId`, role, display name) to client islands. They never hold canvas state.
- **Client Components** own all canvas interaction, Liveblocks room state, and ephemeral UI state. Mounted as islands under `ClientSideSuspense`.
- **Route Handlers** are used for: Liveblocks auth (POST, called by the Liveblocks client), webhooks (raw body), snapshot upload/download (binary/JSON bodies), spec download (file response), and Trigger.dev token issuance.
- **Server Actions** are used for form-style mutations from the UI: create/rename/delete project, invite/remove/change member. Each action re-checks auth and role, validates with Zod, returns a typed result (never throws for expected errors), then `updateTag`/`revalidatePath`.
- **Background tasks** (Trigger.dev) run anything that calls an LLM or takes > 10 s. They receive validated payloads, re-verify project access by `TaskRun` ownership, and write to rooms via `mutateFlow`.

## Next.js 16 Cache Components constraints (VERIFIED, binding)

`next.config.ts` enables `cacheComponents: true` + `partialPrefetching: true`. Consequences every page author must respect (full rules in [code-standards.md](code-standards.md)):

1. `cookies()`, `headers()`, `params`, `searchParams` are async and **must be awaited inside a `<Suspense>`-wrapped child**, never at the top of a page/layout — otherwise `blocking-prerender-runtime` fails the build.
2. Auth reads (`auth()`, which reads cookies) therefore live in Suspense-wrapped children; the auth guide's `'use cache: private'` DAL pattern is the reference.
3. No `runtime`, `dynamic = 'force-dynamic'`, `revalidate`, `fetchCache`, or `dynamicParams` exports anywhere. Trigger.dev's docs suggest `force-dynamic` on routes that use its SDK — **do not**; those routes read `request`/env at runtime and are dynamic by construction.
4. `'use cache'` may not touch request data; pass `userId` in as an argument and tag with `cacheTag`.
5. `proxy.ts` (not `middleware.ts`) is Node-only; Clerk's `clerkMiddleware()` default export is used, with route protection done in pages/handlers/actions, not in proxy.
6. Mutations: `updateTag` in Server Actions; `revalidateTag(tag, 'max')` (two args) in route handlers.

## Canvas architecture (VERIFIED facts → PROPOSED design)

- `<ReactFlow>` renders inside a `'use client'` island under `<ReactFlowProvider>`; `@xyflow/react/dist/style.css` is imported in `globals.css` **after** `@import "tailwindcss"` (Tailwind 4 ordering rule).
- State: `useLiveblocksFlow({ suspense: true, storageKey: 'flow', nodes: { initial: [] }, edges: { initial: [] } })` supplies `nodes/edges/onNodesChange/onEdgesChange/onConnect/onDelete`. **No parallel React state for nodes/edges.** Synced fields: `position`, `width`, `height`, `data`, handles, edge endpoints. Local-only: `selected`, `dragging`, `measured`, `resizing`. Viewport is per-user.
- Node `data` uses the default deep sync (different keys merge). `label` is a single string key written **on commit** (Enter/blur), not per keystroke (F08 D-08a), so concurrent edits resolve last-writer-wins at commit time; acceptable for M1 (D-014).
- Interaction config for an Excalidraw-like feel: `connectionMode="loose"`, `selectionOnDrag`, `selectionMode="partial"`, `panOnScroll`, `panOnDrag={[1,2]}` (middle/right) plus Space+drag, `deleteKeyCode={null}` (we handle Delete/Backspace ourselves so typing in editors is safe and deletion goes through `onDelete`), `fitView` only on initial mount, **never** after a drop (reference bug).
- Drops: palette → canvas via the pointer-events pattern; position = `screenToFlowPosition({x,y})` minus half the default size so the node is centred under the cursor (reference bug).
- Undo/redo: Liveblocks `useUndo/useRedo/useCanUndo/useCanRedo` — per-client, in-memory, automatic with `@liveblocks/react-flow`; does not rebase (documented caveat, D-013).
- Serialization: `CanvasDocument { schemaVersion, nodes, edges }` with runtime fields stripped (`lib/canvas/serialize.ts`). Schema frozen at feature `06`; migrations are pure functions in `lib/canvas/schema.ts`.
- Not provided by React Flow and built by us: inline text editing, context menus, keyboard shortcuts beyond defaults, drop palette, colour toolbar, shape SVGs. Not built at all: freehand strokes, rotation, rich text.

## Collaboration architecture (VERIFIED facts → PROPOSED design)

- Room id = `projectId`. Storage root key `flow` (hook default).
- Auth: **access tokens** (`liveblocks.prepareSession(userId, { userInfo })` → `session.allow(projectId, role === 'viewer' ? ['*:read'] : ['*:write'])`). Permissions live in Postgres; Liveblocks room-level `usersAccesses` are not used (ignored for access tokens). `session.FULL_ACCESS`/`READ_ACCESS` are deprecated — use string arrays.
- Rooms are auto-created on first connection; we also call `getOrCreateRoom(projectId, { defaultAccesses: [] })` at project creation so metadata exists, and `deleteRoom` on project deletion.
- Presence: `{ cursor: {x,y} | null, thinking: boolean }`; `userInfo: { name, avatar, color }` (≤ 1024 chars). `<Cursors/>` from `@liveblocks/react-flow` renders cursors in flow coordinates.
- Revocation: removing a member deletes the row **and** `broadcastEvent(projectId, { type: 'KICK', userId })`; a role change broadcasts `{ type: 'ROLE_CHANGED', userId, role }`. In both cases the client leaves the room and performs a full reload, at which point the auth route re-derives permissions (denies on removal, issues a read token on downgrade). Token TTL is UNVERIFIED (not published) — the broadcast is mandatory, not optional. The auth route never creates rooms (F05 P-05-3).
- Connection status: `useStatus`, `useSyncStatus`, `useLostConnectionListener` drive a status pill; `preventUnsavedChanges: true` on the client.
- Limits (Free/Pro): **10 connections per room**, 10 MB storage per room, `storageUpdated` webhook throttled to 60 s and not guaranteed per write (so autosave is client-driven; the webhook is a backstop).
- Server-side writes (M2): `mutateFlow({ client, roomId, storageKey: 'flow' }, async flow => …)` from `@liveblocks/react-flow/node`, preceded by `createVersionHistorySnapshot` and accompanied by `setPresence(roomId, { userId: 'ai', … , ttl })`. Not transactional across `await`s — generate the full plan first, then apply in one synchronous pass.

## Persistence architecture (APPROVED store, PROPOSED mechanics)

- Live truth: Liveblocks Storage. Durable copy: `CanvasDocument` JSON in the private Blob store at `canvas/{projectId}.json` (`allowOverwrite: true`, `addRandomSuffix: false`), pointer + `canvasSavedAt` + `canvasSchemaVersion` on `Project`.
- Autosave: client-driven, **debounced ≥ 30 s** after the last change plus flush on `visibilitychange`/`pagehide`; only editors/owners save; the server re-validates the JSON with Zod before upload. Rationale for 30 s: Blob advanced-op quota (D-009).
- Load (D-034, PROPOSED): seeding is **server-side**. When the workspace page's gate finds `canvasBlobPath` set, it checks the room via `getStorageDocument`; if the room has zero nodes and zero edges it seeds with `mutateFlow` from the validated, migrated snapshot before rendering. A non-empty room is never overwritten. Server-side seeding works for viewer-only rooms (viewers hold read tokens) and removes the two-clients-seed-at-once race. The cost is one Liveblocks REST read per workspace open.
- Reads of private blobs always go through our route handler (`get(pathname, { access: 'private' })`); blob URLs are never sent to clients.
- Known risk: Blob write and Postgres pointer update are not atomic; the pointer is written only after a successful `put`, and the pathname is deterministic, so the worst case is a stale `canvasSavedAt`.

## Error handling and observability (PROPOSED)

- Expected errors are values: Server Actions return `{ ok: true, data } | { ok: false, error: { code, message } }`; route handlers return JSON `{ error: { code, message } }` with 400 (`VALIDATION`, malformed), 401, 403 (also used for non-member reads, same body as missing project — no existence leak), 409, 422 (`VALIDATION` semantic/limit violations), 429. Exception: `POST /api/liveblocks-auth` returns the Liveblocks-required `{ error: 'forbidden', reason }` body so the client stops retrying.
- Unexpected errors: `app/error.tsx` (client, `retry`), `app/global-error.tsx`, per-segment `not-found.tsx`. Liveblocks connection errors surface via `useErrorListener` into the status pill.
- Logging: `lib/logger.ts` emits structured JSON (`level, msg, requestId, userId, projectId, runId`) to stdout → Vercel runtime logs. Error-reporting SaaS (e.g. Sentry) is **not** added in M1 unless the owner approves (decision D-019 open).

## Open architecture items

See [decision-log.md](decision-log.md) "Open" section and the risk register in [progress-tracker.md](progress-tracker.md).
