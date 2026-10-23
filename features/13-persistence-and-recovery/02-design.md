# F13 — Design

## Architecture and components

```
Next.js server (F04 gate, any role)                                     Stores
  requireProjectRole('viewer') → seedRoomIfEmpty(project)  ──► Liveblocks REST getStorageDocument(projectId)
     canvasBlobPath set & room empty?                      ──► Blob get(canvas/{id}.json, private, useCache:false)
     → migrate → validate → mutateFlow(storageKey 'flow')  ──► Liveblocks Storage (one synchronous pass)
     → SeedResult { seeded, snapshotExists, savedAt, warning } ──► <Workspace seed=…>

Browser (editor)                                  Next.js server                      Stores
<Workspace> ── <SaveProvider initial={seed}>       PUT /api/projects/[id]/canvas ──► Blob put(canvas/{id}.json, private)
  navbar <SaveButton/> ◄── useSaveState()            requireProjectRole('editor')        └─► Postgres Project pointer
  <FlowCanvas> children:                             size → envelope → migrate → validate
    <CanvasPersistence projectId role/>              empty-guard → min-interval → put → update
      useAutosave    ── PUT …/canvas               GET /api/projects/[id]/canvas ──► Blob get(pathname, useCache:false)
    <SeedWarningBanner warning/>                     requireProjectRole('viewer') → parse → migrate → validate   (F19 export, tests, runbooks)
```

Files created: `lib/blob.ts`, `lib/liveblocks-flow.ts` (`seedRoomIfEmpty`, `readFlowCounts`; F17 extends this file with `readFlow`/`aiPresence`), `app/api/projects/[projectId]/canvas/route.ts` (PUT + GET), `hooks/useAutosave.ts`, `components/canvas/canvas-persistence.tsx`, `components/canvas/seed-warning-banner.tsx`, `components/editor/save-context.tsx`, `components/editor/save-button.tsx`, `components/editor/confirm-empty-save-dialog.tsx`, `tests/unit/lib/blob.test.ts`, `tests/unit/lib/liveblocks-flow.seed.test.ts`, `tests/unit/hooks/use-autosave.test.tsx`, `tests/integration/api/canvas-route.test.ts`, `tests/integration/liveblocks-flow.seed.test.ts`, `tests/e2e/persistence.spec.ts`. Modified: `lib/env.ts`, `lib/editor/seed-hook.ts` (F04 stub → re-export of `seedRoomIfEmpty`), `components/editor/workspace.tsx` (wrap in `SaveProvider initial={seed}`; mount `CanvasPersistence` and `SeedWarningBanner` as `FlowCanvas` children; `SaveButton` in navbar slot), `app/editor/actions.ts` (F03 delete → `deleteCanvas`), `package.json`.

`CanvasPersistence` renders nothing; it lives inside `<ReactFlow>` so it can use `useStoreApi()` (subscribe to node/edge array identity without re-rendering) for autosave. The client never writes a snapshot into the room (D-034). `lib/canvas/*` (F06) is the only serialisation/validation code, shared by the route, the seed function and the hook. `lib/liveblocks-flow.ts` is server-only (imports `lib/liveblocks.ts` and `@liveblocks/react-flow/node`); `lib/canvas/*` stays free of Liveblocks imports.

## Domain model and TypeScript contracts

```ts
// lib/blob.ts (server only)
export const canvasPathname = (projectId: string) => `canvas/${projectId}.json`;
export async function putCanvas(projectId: string, doc: CanvasDocument): Promise<{ pathname: string; size: number }>;
export async function getCanvas(projectId: string): Promise<{ json: unknown; size: number } | null>;   // null when get() returns null; throws BlobCorruptError on JSON.parse failure
export async function deleteCanvas(projectId: string): Promise<void>;   // head(pathname) → del(blob.url); no-op if missing; errors logged

// Route schemas (colocated in route.ts)
const PutBodySchema = z.object({ document: z.unknown(), allowEmpty: z.boolean().optional() }).strict();
type PutResponse = { savedAt: string; schemaVersion: number; size: number; pointerUpdated: boolean };
type GetResponse = { document: CanvasDocument | null; savedAt: string | null; schemaVersion: number | null; warning?: 'SNAPSHOT_INVALID' };

// hooks/useAutosave.ts
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'readonly';
export interface AutosaveOptions { projectId: string; enabled: boolean; snapshotExists: boolean | null }
export interface AutosaveState { status: SaveStatus; lastSavedAt: Date | null; lastError: string | null; save: (opts?: { allowEmpty?: boolean }) => Promise<void> }
export const AUTOSAVE_DEBOUNCE_MS = 30_000; export const AUTOSAVE_MAX_WAIT_MS = 60_000; export const KEEPALIVE_MAX_BYTES = 60_000;

// lib/liveblocks-flow.ts (server only; D-034)
export interface SeedInput { id: string; canvasBlobPath: string | null; canvasSchemaVersion: number | null }
export interface SeedResult { seeded: boolean; snapshotExists: boolean; savedAt: string | null; warning: 'SEED_FAILED' | 'SNAPSHOT_INVALID' | null }
export async function readFlowCounts(roomId: string): Promise<{ nodes: number; edges: number }>;   // getStorageDocument(roomId, 'json') → counts under the `flow` key (shape from F05 spike (f))
export async function seedRoomIfEmpty(project: SeedInput, ctx: { userId: string; requestId: string }): Promise<SeedResult>;
//   null canvasBlobPath → { seeded:false, snapshotExists:false, savedAt:null, warning:null } (no Liveblocks call)
//   counts > 0          → { seeded:false, snapshotExists:true, … }
//   else getCanvas → migrate → validateDocument (fail → warning 'SNAPSHOT_INVALID', no write)
//        → mutateFlow({ client: getLiveblocks(), roomId, storageKey: 'flow' }, flow => { for n of nodes: flow.addNode(n); for e of edges: flow.addEdge(e) })  // no await inside
//        → { seeded:true, snapshotExists:true, savedAt }
//   any rejection → logger.error({ projectId, userId, requestId, step }) → warning 'SEED_FAILED'; never throws

// components/editor/save-context.tsx
export function SaveProvider(props: { initial: SeedResult; children }): JSX.Element;   // seeds snapshotExists/savedAt; holds AutosaveState set by CanvasPersistence
export function useSaveState(): AutosaveState & { role: ProjectRole; seed: SeedResult };
```

`Project` fields (from F03, per `domain-model.md`): `canvasBlobPath: string?`, `canvasSchemaVersion: int?`, `canvasSavedAt: datetime?`. If F03 shipped without them, F13 T-001 adds a Prisma migration (`add_project_canvas_pointer`) — a separate authorization per the template.

## Data and state ownership

| State | Owner | This feature |
|---|---|---|
| Live nodes/edges | Liveblocks Storage | read via React Flow store for serialisation (client); written by the server seed (`mutateFlow`) only into an empty room (D-034) |
| Snapshot document | Vercel Blob `canvas/{projectId}.json` | written by PUT; authoritative only when the room is empty (data-ownership row) |
| Pointer (`canvasBlobPath`, `canvasSavedAt`, `canvasSchemaVersion`) | Postgres | metadata; updated after a successful put; read by GET and by the gate for `savedAt`/`snapshotExists` |
| Save status, timers, last-saved hash | Client memory | ephemeral |
| Undo history | Client memory | untouched by seeding: the seed is a server write (remote origin, F17-style) and never enters a user's stack |
| `SeedResult` | Server render → client prop | derived per request; not persisted |

Derived copy justification: the Blob snapshot is the only derived copy and is mandated by D-009.

## API and integration contracts

| Method/path | Min role | Request | Success | Errors |
|---|---|---|---|---|
| `PUT /api/projects/[projectId]/canvas` | editor | JSON `{ document, allowEmpty? }` ≤ 4 MB | 200 `PutResponse` | 401 `UNAUTHENTICATED`; 403 `FORBIDDEN` (non-member, viewer, missing project — same body); 400 `VALIDATION` (malformed JSON/envelope); 422 `VALIDATION` (size, schema, caps; `issues[]` with paths); 409 `CONFLICT` `{ reason: 'empty_document' }`; 429 `RATE_LIMITED` + `Retry-After: <s>`; 502 `UPSTREAM` (blob) |
| `GET /api/projects/[projectId]/canvas` | viewer | — | 200 `GetResponse`, `Cache-Control: no-store` | 401; 403 (same body for non-member/missing); 502 `UPSTREAM` (blob unreachable — distinct from invalid JSON, which is 200 + `warning`) |

PUT ordering (binding): role → size → envelope → `migrate` → `validateDocument` → empty-guard (needs `project.canvasBlobPath` from the role lookup's project) → min-interval (`project.canvasSavedAt`) → `putCanvas` → `prisma.project.update` (failure → log, `pointerUpdated: false`). Non-atomicity documented: a crash between put and update leaves a newer blob with an older pointer; P-13-4 makes GET independent of the pointer.

Seed path (no HTTP endpoint): the F04 gate calls `seedRoomIfEmpty(project, { userId, requestId })` after `requireProjectRole(projectId, 'viewer')` — so it runs only for authorized members of any role, with `projectId` taken from the authorized project row, never from client input. It uses the secret-key node client (`lib/liveblocks.ts`); nothing about seeding is exposed to the browser except `SeedResult`. Client flow: `SaveProvider` receives `initial = seed`; `useAutosave` arms its subscription after suspense resolves and initialises its last-saved hash from the current store, so a freshly seeded room never counts as dirty. Room events: none. Liveblocks server APIs used in M1: `getStorageDocument`, `mutateFlow` (seed only; P-13-6 backstop still deferred).

## Security and validation

- Threats and controls: forged `projectId` → `requireProjectRole` (both routes and, via the gate, the seed); oversized upload → `content-length` + measured body ≤ 4 MB (422) before parsing; malicious document → full Zod validation incl. integrity rules (F06 P-06-5) on PUT, on GET and before every seed; quota exhaustion → 10 s min-interval (P-13-2) + client debounce + at most one Liveblocks REST read per open; blob URL leakage → responses and `SeedResult` carry only `document`/`savedAt`/flags (unit-asserted: no `blob.vercel-storage.com` substring); snapshot poisoning by a viewer → viewer cannot PUT (403) and cannot write Storage (F05 read token); a viewer *can* trigger a seed by opening the project, but the seed writes only the validated snapshot that an editor saved; accidental wipe → P-13-1 guard client and server side; non-empty room never overwritten (FR-010).
- Validation order follows security-model: authenticate → authorize → validate.
- Rate limit is per project, DB-backed via `canvasSavedAt`; no Redis/KV (security-model "Rate limiting").

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `@vercel/blob` latest 2.8.2; private stores GA (SDK ≥ 2.3); access mode is a store property but `access` must still be passed | https://registry.npmjs.org/@vercel%2Fblob/latest ; https://vercel.com/docs/vercel-blob/private-storage | 2026-10-22 |
| `get(pathname, { access: 'private', useCache: false })` → `null` or `{ stream, blob }`; bypasses CDN for read-after-overwrite consistency; delivery to browsers must go through a Function | https://vercel.com/docs/vercel-blob/private-storage ; https://vercel.com/docs/vercel-blob/using-blob-sdk | 2026-10-22 |
| `put(pathname, body, { access, addRandomSuffix (default false), allowOverwrite (default false), contentType, cacheControlMaxAge })`; overwrites propagate through CDN ≤ 60 s | https://vercel.com/docs/vercel-blob/using-blob-sdk ; https://vercel.com/docs/vercel-blob | 2026-10-22 |
| Server uploads bounded by the 4.5 MB Function body limit | https://vercel.com/docs/vercel-blob/server-upload | 2026-10-22 |
| Advanced ops (put) $5/1M; Hobby 2k advanced ops/month, 900/min rate limit | https://vercel.com/docs/vercel-blob/usage-and-pricing | 2026-10-22 |
| OIDC auth by default on Vercel (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`); `BLOB_READ_WRITE_TOKEN` for CI/local | https://vercel.com/docs/vercel-blob | 2026-10-22 |
| `storageUpdated` webhook throttled 60 s, may not fire for every write | https://liveblocks.io/docs/api-reference/webhook-events | 2026-10-22 |
| Offline edits queue and replay on reconnect; `history.clear()` affects only the local stack; `history.disable(fn)` stable since 3.19.0 | https://liveblocks.io/docs/guides/how-conflict-resolution-works-in-liveblocks-sync ; https://liveblocks.io/docs/api-reference/liveblocks-client ; https://liveblocks.io/changelog/page/3 | 2026-10-22 |
| `mutateFlow({ client, roomId, storageKey }, cb)` from `@liveblocks/react-flow/node` exposes `addNode`/`addEdge`; `addNode` with an existing id replaces it (idempotent seeding); changes flush at the end of the callback | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | 2026-10-22 |
| `getStorageDocument(roomId, 'json')` returns the room's Storage as plain JSON (server-side read) | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| Server-side writes arrive at clients as remote changes and are not recorded in any client's undo history (inferred; proven by F17 AC-027 and re-asserted here by TC-019's undo step) | https://liveblocks.io/docs/products/sync/server-side-editing | 2026-10-22 (inferred) |

UNVERIFIED (with fallback):
- `del()` accepting a pathname rather than a URL for private stores — design uses `head(pathname).url` then `del(url)`; if `head` is unavailable on private stores, `list({ prefix: pathname })` supplies the URL.
- Browser keepalive body limit (64 KB) is general web-platform knowledge, not fetched; P-13-5's 60 KB threshold is conservative either way.
- Exact JSON shape of the `flow` key from `getStorageDocument` (needed by `readFlowCounts`) and `mutateFlow` runtime semantics (timeouts, flush) — F05 spike (a)/(f) (R-05); fallback: read counts via a read-only `mutateFlow` callback that returns `flow.toJSON()` (the F17 `readFlow` pattern).
- Clearing room storage on the dev server for the E2E (`deleteStorageDocument`) — F05 spike (f); fallback `deleteRoom` + reconnect.
