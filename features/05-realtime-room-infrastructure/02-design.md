# F05 — Design

## Architecture and components

Dependency direction `app → components → lib → SDKs` is kept: route handlers in `app/api/*` call `lib/auth.ts`, `lib/access.ts`, `lib/liveblocks.ts`; client components in `components/editor/*` call only the Liveblocks React SDK and `fetch` our routes.

Files created:

| Path | Kind | Responsibility |
|---|---|---|
| `types/liveblocks.config.ts` | types | Global `Liveblocks` interface, `USER_COLORS`, `KickEvent`/`RoleChangedEvent` aliases |
| `lib/liveblocks.ts` | server lib | Cached node client + helpers |
| `app/api/liveblocks-auth/route.ts` | route handler | Token issuance |
| `app/api/users/resolve/route.ts` | route handler | `resolveUsers` backend |
| `app/api/webhooks/liveblocks/route.ts` | route handler | Verified webhook receiver (log only in M1) |
| `components/editor/project-room.tsx` | client | `ProjectRoom` providers + suspense + error boundary |
| `components/editor/room-fallbacks.tsx` | client | `RoomLoading`, `RoomError` |
| `components/editor/connection-status.tsx` | client | Status pill + lost-connection toasts |
| `components/editor/kick-listener.tsx` | client | KICK / ROLE_CHANGED for self → overlay → `suppress()` → `client.logout()` → `window.location.reload()`; `onReconnected` hook point (F12 fills with `checkMyAccess`) |
| `components/editor/unload-guard.tsx` | client | `UnloadGuardProvider` + `useUnloadGuard()` → `{ suppress(): void }`; wraps Liveblocks' `preventUnsavedChanges` so a forced reload skips the prompt |
| `components/ui/sonner.tsx` | generated | shadcn `sonner` (`<Toaster/>` mounted in `app/providers.tsx`); F14 reuses it |
| `playwright.config.ts` (F00, modified), `tests/e2e/fixtures/two-users.ts`, `tests/e2e/helpers/liveblocks.ts`, `tests/e2e/room-smoke.spec.ts` | tests | Harness — the root config gains env wiring for the dev server; no second config file |
| `.env.example` | config | Keys without values |

Files modified: `lib/env.ts` (new keys), `components/editor/workspace.tsx` (F04; body wrapped in `<ProjectRoom>`), `app/editor/actions.ts` (F03; `ensureRoom`/`deleteRoom` calls), `package.json`.

```
<Workspace projectId role currentUser>            (F04, client island)
  <ProjectRoom projectId currentUser>             (F05)
    <LiveblocksProvider authEndpoint throttle=50 lostConnectionTimeout=5000 preventUnsavedChanges resolveUsers baseUrl?>
      <RoomProvider id={projectId} initialPresence={{cursor:null, thinking:false}}>
        <RoomErrorBoundary>                        (useErrorListener → RoomError)
          <ClientSideSuspense fallback={<RoomLoading/>}>
            <KickListener/> <ConnectionStatus/>
            {children}                              ← F06 FlowCanvas
```

`ProjectRoom` is mounted once per workspace; its root element carries `data-role`, `data-can-write` (from `useSelf(me => me.canWrite)`) and `data-connection-status` for E2E assertions (F12 TC-024/TC-025). A KICK/ROLE_CHANGED ends with a full reload, so the room is left by page teardown, never by client-side navigation.

## Domain model and TypeScript contracts

```ts
// types/liveblocks.config.ts
import type { LiveMap, LiveObject } from '@liveblocks/client';

export const USER_COLORS = [
  '#52A8FF', '#BF7AF0', '#FF990A', '#FF6166', '#F75F8F', '#62C073', '#0AC7B4',
] as const;                                   // = NODE_COLORS[blue..teal].text (P-05-6); asserted equal in F06 test
export type UserColor = (typeof USER_COLORS)[number];

export type KickEvent = { type: 'KICK'; userId: string };
export type RoleChangedEvent = { type: 'ROLE_CHANGED'; userId: string; role: 'editor' | 'viewer' };  // PROPOSED P-05-2
export type CanvasReplacedEvent = { type: 'CANVAS_REPLACED'; byUserId: string; templateName?: string };   // emitted by F14; shape per domain-model.md

declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null; thinking: boolean };
    // Managed by @liveblocks/react-flow under storageKey 'flow'; never hand-edited (F17 mutateFlow uses the same key).
    Storage: { flow: LiveObject<{ nodes: LiveMap<string, LiveObject<Record<string, unknown>>>; edges: LiveMap<string, LiveObject<Record<string, unknown>>> }> };
    UserMeta: { id: string; info: { name: string; avatar: string | null; color: string } };
    RoomEvent: KickEvent | RoleChangedEvent | CanvasReplacedEvent;
  }
}
export {};
```

The exact `Storage` generic for the react-flow package's internal shape is UNVERIFIED (the API reference does not print it); the spike records the real LSON shape returned by `getStorageDocument(roomId, 'json')` and the type is adjusted to match. Consumers never touch `Storage` directly.

```ts
// lib/liveblocks.ts (server only; no React)
export function getLiveblocks(): Liveblocks;                                   // cached on globalThis in dev; uses env.LIVEBLOCKS_SECRET_KEY and optional env.LIVEBLOCKS_BASE_URL
export async function ensureRoom(projectId: string): Promise<void>;           // getOrCreateRoom(projectId, { defaultAccesses: [] }); errors logged, not thrown
export async function deleteRoom(projectId: string): Promise<void>;           // liveblocks.deleteRoom(projectId); not thrown if missing or failing (logged)
export async function kickUser(projectId: string, userId: string): Promise<boolean>;     // broadcastEvent(projectId, { type: 'KICK', userId }); retries once; on final failure logger.error({ projectId, userId, op: 'kickUser' }) and returns false (never throws)
export async function notifyRoleChanged(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<boolean>; // broadcastEvent(projectId, { type: 'ROLE_CHANGED', userId, role }); same retry/return semantics
export function userColor(userId: string): UserColor;                        // FNV-1a 32-bit hash of userId mod USER_COLORS.length
```

`userColor` is pure and isomorphic; it is re-exported for the client from `lib/user-color.ts` (no server imports) so F11 can colour avatars without a round-trip. F12 calls `kickUser` (removal) / `notifyRoleChanged` (role change) after its Postgres write and surfaces the boolean as `kickDelivered`; F03's delete action calls `kickUsers` (per id) then `deleteRoom`.

## Data and state ownership

| State | Owner (per data-ownership.md) | This feature |
|---|---|---|
| Membership/roles | Postgres | Read at token time only; never written |
| Access token claims | Liveblocks (short-lived projection) | Minted per `authorize()`; re-derived on every join; invalidated by KICK/ROLE_CHANGED reload |
| Presence | Liveblocks Presence | `initialPresence` only; cursors set by F11 |
| Storage `flow` | Liveblocks Storage | Declared, untouched |
| Connection status, toasts | Client memory | Ephemeral |
| Room metadata | Liveblocks | `ensureRoom`/`deleteRoom` mirror project lifecycle (best effort) |

No new derived copies.

## API and integration contracts

### `POST /api/liveblocks-auth`
- Auth: `requireUser()` (401 → body `{ error: 'forbidden', reason: 'unauthenticated' }`). Minimum role: `viewer`.
- Request (Zod): `{ room: z.string().regex(/^c[a-z0-9]{24}$/) }` — cuid v1 shape produced by Prisma `cuid()` (F03). Failure → 403 `{ error: 'forbidden', reason: 'invalid_room' }` before any DB access.
- Success: `session.authorize()` → `new Response(body, { status, headers: { 'Cache-Control': 'no-store' } })`. `userInfo = { name: user.name ?? user.email, avatar: user.avatarUrl ?? null, color: userColor(user.id) }` (≤ 1024 chars; name truncated to 80).
- Errors: 403 `{ error: 'forbidden', reason: 'no_access' }` for non-member and missing project (identical); 502 `{ error: { code: 'UPSTREAM', message } }` if `authorize()` throws (client retries).

### `GET /api/users/resolve?ids=<cuid>,<cuid>`
- Auth: `requireUser()` → 401 `{ error: { code: 'UNAUTHENTICATED' } }`. Query Zod: 1–50 cuids, deduped.
- Response 200 `{ users: Array<{ id: string; name: string; avatar: string | null }> }` — only ids where a project exists such that caller ∈ {owner, member(userId)} and target ∈ {owner, member(userId)}; others omitted. `Cache-Control: private, max-age=60`.
- Errors: 400 `VALIDATION`.

### `POST /api/webhooks/liveblocks`
- Public route (proxy matcher excludes `/api/webhooks/*`). `verifyRequest({ headers: Object.fromEntries(request.headers), rawBody: await request.text() })`; throw → 400 `{ error: { code: 'VALIDATION', message: 'invalid signature' } }`.
- Handled (M1): `roomCreated`, `userEntered`, `userLeft`, `storageUpdated` → `logger.info({ projectId: roomId, userId?, event: type })`. All verified events → 200 `{ received: true }`. `storageUpdated` handling is reserved for the F13 backstop (deferred).

### Room events (`broadcastEvent`, server → clients)
| Event | Emitter | Listener behaviour |
|---|---|---|
| `KICK { userId }` | F12 remove member (via `kickUser`); F03 delete project (via `kickUsers`) | self → overlay → `suppress()` → `client.logout()` → `window.location.reload()` → gate renders AccessDenied |
| `ROLE_CHANGED { userId, role }` | F12 change role (via `notifyRoleChanged`) | self → same path → reload → gate passes the new role; auth route issues `*:read` / `*:write` |
| `CANVAS_REPLACED { byUserId, templateName? }` | F14 | not handled in F05 |
| (reconnect) | — | `onReconnected` hook point; F12 registers `checkMyAccess({ projectId })` and takes the KICK path on a mismatch (D-032) |

## Security and validation

- Threat: forged `room` → mitigated by cuid check + `requireProjectRole`. Threat: stale token after removal (R-03) → KICK/ROLE_CHANGED are mandatory and end in `client.logout()` + reload (cached tokens purged; the next connection re-authenticates through this route); the listener also re-checks on `useErrorListener` -1/4001 and, via F12's `checkMyAccess` on reconnect, covers events missed offline. Threat: enumeration via `resolve` → scoped to shared projects, 50-id cap. Threat: webhook spoofing → HMAC verify on raw body; timestamp window enforced by the SDK. Threat: secret leakage → only `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` is public; `lib/liveblocks.ts` is imported only from server files (ESLint `no-restricted-imports` rule from `components/**`).
- Rate limiting: none added; token issuance is bounded by the Liveblocks client's own retry/backoff and the forbidden body stops loops.
- Room-level `usersAccesses`/`updateRoom` are never used (invariant 4).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| All `@liveblocks/*` must share one version; latest 3.24.4 (2026-10-21) | https://registry.npmjs.org/@liveblocks/react-flow ; https://liveblocks.io/docs/get-started/nextjs-react-flow | 2026-10-22 |
| `prepareSession(userId, { userInfo })` → `allow(room, ['*:read'|'*:write'])` → `authorize()`; `FULL_ACCESS`/`READ_ACCESS` deprecated | https://liveblocks.io/docs/api-reference/authentication/access-token/nextjs ; https://liveblocks.io/blog/whats-new-in-liveblocks-june-2026 | 2026-10-22 |
| Room-level user/group accesses ignored with access tokens | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| `{ error: 'forbidden', reason }` body disconnects the client and stops retries; "never cache your auth endpoint" | https://liveblocks.io/docs/api-reference/liveblocks-client | 2026-10-22 |
| `throttle` default 100 ms, range 16–1000; `lostConnectionTimeout` default 5000 (1000–30000); `preventUnsavedChanges` adds `beforeunload` guard | https://liveblocks.io/docs/api-reference/liveblocks-react ; https://liveblocks.io/docs/api-reference/liveblocks-client | 2026-10-22 |
| `useStatus` values `initial|connecting|connected|reconnecting|disconnected`; `useSyncStatus` `synchronizing|synchronized`; `useLostConnectionListener` `lost|restored|failed`; error codes -1, 4001, 4005, 4006 | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| Removed users are not auto-disconnected; broadcast-kick + client leave is the documented pattern; token TTL unpublished | https://liveblocks.io/docs/use-cases/share-dialog | 2026-10-22 |
| `ClientSideSuspense` always renders fallback on the server; `RoomProvider initialPresence` applied once | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| `WebhookHandler.verifyRequest({ headers, rawBody })`; `storageUpdated` throttled 60 s, not per write; retries 0s…10h, auto-disable after 5 days of failures | https://liveblocks.io/docs/platform/webhooks ; https://liveblocks.io/docs/api-reference/webhook-events | 2026-10-22 |
| `getOrCreateRoom(id, { defaultAccesses: [] })`, `deleteRoom` does not throw if missing, `broadcastEvent` | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| Playwright guide: `npx liveblocks dev --no-persist --no-check`, port 1153, `pk_localdev`, `baseUrl` prop on `LiveblocksProvider` | https://liveblocks.io/docs/guides/how-to-set-up-end-to-end-e2e-testing-with-playwright | 2026-10-22 |
| 10 connections/room on Free and Pro (error 4005) | https://liveblocks.io/pricing | 2026-10-22 |

UNVERIFIED (spike T-001 resolves; fallbacks stated):
- Dev server accepting access tokens signed by our route with a local secret and `baseUrl` on the node client. Fallback: in `E2E=1` the provider uses `publicApiKey: 'pk_localdev'`; token permissions are then proven at L2 only, and the viewer read-only E2E asserts UI affordances instead of rejected writes.
- Whether a 401 status with the forbidden body stops retries. Fallback: return 403 for unauthenticated too (noted in the AUTHZ matrix as "401 or 403-with-forbidden-body").
- `deleteStorageDocument` on the dev server (needed by F13 TC). Fallback: `deleteRoom` + reconnect.
- Whether `client.logout()` alone forces a re-auth on the next connection without a reload — not relied upon: the design always reloads after `logout()` (D-031), so the token purge and the fresh server render both happen.
