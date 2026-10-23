# F11 — Design

## Architecture and components

```
<Workspace projectId role currentUser>                        (F04)
├─ top-right slot: <PresenceStack currentUserId={currentUser.id}/>   (F11; includes <UserButton/>)
└─ <ProjectRoom> → <FlowCanvas role>                          (F05/F06)
      └─ children: <LiveCursors/>                             (F11; wraps <Cursors components={{ Cursor: CanvasCursor }}/>)
                   <PresenceHygiene/>                         (F11; null cursor on hide/blur)
```

Files created: `components/canvas/live-cursors.tsx`, `components/canvas/canvas-cursor.tsx`, `components/canvas/presence-hygiene.tsx`, `components/canvas/presence-stack.tsx`, `components/canvas/presence-avatar.tsx`, `lib/initials.ts` (pure), `tests/unit/components/{canvas-cursor,presence-stack,presence-avatar}.test.tsx`, `tests/unit/lib/initials.test.ts`, `tests/e2e/presence.spec.ts`. Modified: `app/globals.css` (two style imports), `components/editor/workspace.tsx` (top-right slot content; `UserButton` moves inside `PresenceStack`).

Client-only; no server code. `PresenceStack` reads `useOthers` with a selector that maps to `{ id, name, avatar, color, connections }` and dedupes, so it re-renders only when that projection changes (not on every cursor move). `LiveCursors` renders nothing itself except the `<Cursors/>` element.

## Domain model and TypeScript contracts

```ts
// Presence/UserMeta: from types/liveblocks.config.ts (F05) — unchanged.
//   Presence: { cursor: { x: number; y: number } | null; thinking: boolean }
//   UserMeta: { id: string; info: { name: string; avatar: string | null; color: string } }

// lib/initials.ts
export function initials(name: string): string;      // 'Ada Lovelace' → 'AL'; 'linus' → 'L'; '' → '?'

// components/canvas/canvas-cursor.tsx
import type { CursorsCursorProps } from '@liveblocks/react-flow';
export function CanvasCursor(props: CursorsCursorProps): JSX.Element;
//   Expected (UNVERIFIED exact shape) to receive the other's connection/user context; the component resolves
//   { name, color, thinking } via useOthers(selector by connectionId) if props carry connectionId, else via props.info.

// components/canvas/presence-stack.tsx
export interface PresenceStackProps { currentUserId: string; max?: number /* default 5; 3 under md */ }
export function PresenceStack(props: PresenceStackProps): JSX.Element;
//   others = useOthers(list => dedupeById(list.filter(o => o.id !== currentUserId)))   // shallow-compared
//   dedupeById keeps first-seen order; entry = { id, name, avatar, color, tabs: number }

// components/canvas/presence-avatar.tsx
export interface PresenceAvatarProps { name: string; avatar: string | null; color: string; tabs: number; size?: 32 }
```

Presence write path (only one): `<Cursors/>` updates `cursor` on pointer events; `PresenceHygiene` calls `useUpdateMyPresence()({ cursor: null })` on `document.visibilitychange` (hidden) and `window.blur`. No other component writes presence in M1; `thinking` is written server-side in M2 (`setPresence`) and never from the client in M1.

## Data and state ownership

| State | Owner | Note |
|---|---|---|
| `cursor`, `thinking` per connection | Liveblocks Presence | ephemeral; lost on disconnect (data-ownership row "Presence") |
| `info` (name, avatar, color) | Liveblocks token claim (from Postgres `User` via F05 auth) | read-only here; `resolveUsers` (F05) supplies names for the Liveblocks UI |
| Tooltip open state, image error state | Client memory | ephemeral |

No derived copies: `others` is read through selectors; nothing is stored in `useState`.

## API and integration contracts

No routes, actions, or room events. Consumes F05 `GET /api/users/resolve` indirectly through `resolveUsers` on `LiveblocksProvider`. Integration contract with F06: `LiveCursors` and `PresenceHygiene` are passed as children of `<FlowCanvas>`; contract with F04: `PresenceStack` replaces the bare `UserButton` in the top-right slot of the workspace only (editor home untouched). Contract with F16/F17: the agent's server-side presence (`userId: 'ai'`, `info.name: 'drawArc AI'`, `thinking: true`) renders through `CanvasCursor`/`PresenceAvatar` with no changes.

## Security and validation

- `info.name`/`info.avatar` originate from our auth route (F05) and are rendered as text / `next/image` with `remotePatterns` limited to `https://img.clerk.com/**` — a hostile avatar URL from any other host is refused by Next (asserted in a unit test reading `next.config.ts`). Names are rendered as React text (no HTML).
- Presence payload size: `cursor` is two numbers; `info` ≤ 1024 chars (Liveblocks limit, enforced in F05 by truncation).
- No PII beyond what the room already exposes; `resolveUsers` scoping (F05 FR-008) prevents enumeration.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `Cursors` is exported by `@liveblocks/react-flow`, rendered as a child of `<ReactFlow>`, draws others' cursors in flow coordinates (pan/zoom aware); props `presenceKey` (default `"cursor"`) and `components` (custom `Cursor`); needs `@liveblocks/react-ui/styles.css` and `@liveblocks/react-flow/styles.css`; names/colours come from `resolveUsers` | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | 2026-10-22 |
| Cursor pattern: set `cursor` on pointer move, `null` on leave; render others from `useOthers` | https://liveblocks.io/docs/products/sync/presence | 2026-10-22 |
| `useOthers(selector)` / `useOthersMapped`; entries carry `connectionId`, `presence`, `info`, `id`; `useUpdateMyPresence` returns only the updater (fewer re-renders) | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| `lostConnectionTimeout` (default 5000) also controls when `others` resets to `[]` | https://liveblocks.io/docs/api-reference/liveblocks-client | 2026-10-22 |
| `throttle` default 100 ms, range 16–1000 (F05 sets 50) | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| Server-side `setPresence(roomId, { userId, userInfo, data, ttl })` for agents (M2 consumer of this UI) | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| `<ViewportPortal>` renders children in flow coordinates (fallback path) | https://reactflow.dev/api-reference/components/viewport-portal | 2026-10-22 |

UNVERIFIED (resolved in T-001 of this feature, half a day):
- The exact `CursorsCursorProps` shape (whether it carries `connectionId`, `info`, `presence`, or only `x`/`y`). Fallback P-11-1: `cursors-fallback.tsx` with `useOthersMapped` + `<ViewportPortal>` + `onPaneMouseMove`/`onPaneMouseLeave` → `screenToFlowPosition`, throttled by Liveblocks' own presence throttle. Either path satisfies every AC; only the file differs.
- Whether `<Cursors/>` already clears the cursor on pane leave (documented for the generic pattern, not stated for the component). `PresenceHygiene` covers hide/blur regardless; T-001 confirms leave and, if missing, adds `onPaneMouseLeave` → `{ cursor: null }`.
- Whether `<Cursors/>` scales the glyph with zoom (EC-008). If it does, the custom component applies `transform: scale(1/zoom)` from `useViewport()`.
