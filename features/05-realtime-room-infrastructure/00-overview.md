# F05 — Realtime Room Infrastructure

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F03 (`requireProjectRole`, `User` rows, Project cuids), F02 (`requireUser`), F04 (workspace island `<Workspace projectId role currentUser>` that this feature wraps in a room) |
| Depended on by | F06 (canvas uses the room), F11 (presence), F12 (KICK / ROLE_CHANGED / `deleteRoom`), F13 (room-empty check, webhook backstop), F17 (`mutateFlow` with `storageKey: 'flow'`) |
| Product requirements | PRD-012, PRD-013, PRD-030, PRD-032 |
| Status | see status.md |

## Purpose

F05 installs Liveblocks and gives every project a Liveblocks room whose id is the project id, reachable only through an access token minted by our server from the caller's Postgres role. It provides the client providers (connection, room, suspense boundary), the connection-status UI, the revocation (KICK) path, the webhook receiver, the server-side client helpers that later features call, and the two-user Playwright harness. It sits after F03 because tokens are derived from `requireProjectRole`, and before F06 because the canvas is rendered inside the room this feature establishes. Nothing in F05 renders nodes or edges.

## Problem statement and goals

- Problem: real-time collaboration must be part of the base architecture (principle 2). Without a verified room, auth, and status layer, F06–F13 cannot be built or tested, and the undocumented parts of `@liveblocks/react-flow` (R-05) would be discovered mid-feature.
- G-1: A member can join room `projectId` with a token whose permissions equal their Postgres role (`viewer` → `['*:read']`, otherwise `['*:write']`); a non-member cannot join and the client stops retrying.
- G-2: Removing a member ejects their open session within 5 s (PRD-013); downgrading re-issues a read token within 5 s.
- G-3: Connection loss, reconnection, and sync state are visible in the UI and unsynced changes are guarded on tab close (PRD-032).
- G-4: A two-browser-context Playwright harness against the Liveblocks dev server exists and runs one smoke test, so F06/F11/F13 can write collaboration tests on day one.
- G-5: The R-05 unknowns (`mutateStorage` semantics, `updateNode` merge depth, viewport sync, `onNodesChange` add path, dev-server auth) are answered by a spike before F06 starts.

## Scope

In scope:
- `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/react-ui`, `@liveblocks/react-flow`, `@liveblocks/node` at exactly `3.24.4`.
- `types/liveblocks.config.ts` global `Liveblocks` interface (Presence, Storage note, UserMeta, RoomEvent).
- `lib/liveblocks.ts`: cached node client, `ensureRoom`, `deleteRoom`, `kickUser`, `notifyRoleChanged`, `userColor`.
- `POST /api/liveblocks-auth`, `GET /api/users/resolve`, `POST /api/webhooks/liveblocks`.
- `components/editor/project-room.tsx` (`LiveblocksProvider` + `RoomProvider` + `ClientSideSuspense` + fallbacks, `useUnloadGuard()` context, `data-role`/`data-can-write`/`data-connection-status` attributes for tests), `connection-status.tsx`, `kick-listener.tsx` (KICK and ROLE_CHANGED for self → overlay → `client.logout()` → full reload; exposes the reconnect re-verification hook point that F12 fills with `checkMyAccess`, D-032).
- Env vars, `.env.example`, `lib/env.ts` additions.
- Playwright: the Liveblocks dev server entry F00 already guards behind `E2E_LIVEBLOCKS=1` in the root `playwright.config.ts` is activated; two authenticated browser contexts (`twoUsers` fixture); one smoke test.
- Spike T-001 answering the R-05 questions on the dev server.

Out of scope / non-goals:
- Rendering nodes/edges, `useLiveblocksFlow` (F06). Cursor rendering and avatar stack (F11). Snapshot persistence and `storageUpdated` backstop (F13). Membership UI and the Server Action that calls `kickUser` (F12). Server-side `mutateFlow` writes (F17). Comments, Feeds, Yjs (never in M1–M3; D-012).

## User stories

- US-1: As an editor, I want to open a project and be connected to its room so that my edits (F06+) reach everyone immediately.
- US-2: As a viewer, I want to see the live room without being able to write so that I can follow along safely (PRD-012).
- US-3: As a collaborator on a flaky network, I want to see "Reconnecting…" and be warned before closing a tab with unsynced changes so that I do not lose work (PRD-032).
- US-4: As a project owner, when I remove someone, I want them out of the room within 5 s so that access control is real (PRD-013).
- US-5 (abuse): As a non-member holding a project URL, I must not be able to obtain a room token, even by crafting the auth request body with another project's id.
- US-6 (abuse): As a removed member whose tab is still open, I must not keep editing after removal.

## Key decisions referenced

- D-012 (Storage via `@liveblocks/react-flow`), D-015 (access tokens from Postgres roles, room id = projectId), D-017 (test toolchain), D-023 (single exact Liveblocks version), D-031/D-032 (F12: KICK/ROLE_CHANGED → `client.logout()` + reload; reconnect re-verification via `checkMyAccess`), D-034 (server-side seeding uses this feature's node client; `getStorageDocument`/`mutateFlow` semantics are spiked in T-001), F01/D-F01-1 (`@xyflow/react` is installed by F01, so the `@liveblocks/react-flow` peer is already satisfied).
- PROPOSED by this feature (copy to the decision log on approval):
  - **P-05-1** `throttle: 50` ms on `LiveblocksProvider`. Rationale: 100 ms (default) makes remote cursors visibly step; 16 ms doubles presence traffic for no perceptible gain over 50 ms at typical 60 Hz pointer sampling; 50 ms keeps a 10-person room under 200 presence messages/s.
  - **P-05-2** `{ type: 'ROLE_CHANGED'; userId; role }` is a distinct `RoomEvent` member (now recorded in `context/domain-model.md` "Liveblocks room shape" and `security-model.md` "Revocation"). KICK means removal; ROLE_CHANGED means re-authenticate with the new role. The client reaction is the same for both (`client.logout()` + full reload — F12 D-031, security-model); only the outcome after the reload differs (AccessDenied vs. a fresh token with the new role). Reconnect re-verification via F12's `checkMyAccess` Server Action (D-032) covers events missed while offline.
  - **P-05-3** The auth route does not create rooms; `ensureRoom` is called from the F03 create-project Server Action (wired by T-004) so room metadata exists before first join. Rationale: rooms auto-create on first connection with access tokens; calling the REST API from the auth route adds latency to every token.
  - **P-05-4** `GET /api/users/resolve?ids=` is a route handler (not a Server Action) because `components/` must not import from `app/` (dependency direction) and the `resolveUsers` callback lives in a component.
  - **P-05-5** Invalid room id and non-member both return the Liveblocks "forbidden" body (`{ error: 'forbidden', reason }`) so the client disconnects instead of retrying; this body shape intentionally differs from the app-wide `{ error: { code, message } }` envelope (justified by the Liveblocks client protocol).
  - **P-05-6** `USER_COLORS` (7 hex values, equal to the non-neutral `NODE_COLORS[*].text` values) live in `types/liveblocks.config.ts`. This is an exception to the "hex only in `types/canvas.ts` and `globals.css`" rule because F05 precedes F06; F06 adds a unit test asserting equality so the palettes cannot drift.

## Reference material

- `context/architecture-context.md` "Collaboration architecture", `context/security-model.md` "Collaboration room access", `context/testing-strategy.md` (L2/L3 environment), `context/domain-model.md` "Liveblocks room shape".
- Research `research/liveblocks.md` sections 1–13 (checked 2026-10-22), `research/nextjs-testing.md` Part 2 (Liveblocks Playwright guide, checked 2026-10-22).
- Reference prompt `No_touch_ai/…/feature-specs/10-liveblocks-setup.md` (product intent only: cached client, deterministic colour, 403 on no access). Its "ensure room exists in the auth route" step is superseded by P-05-3.
- Risks R-02 (10 connections/room → error 4005 surfaced), R-03 (revocation not immediate → KICK mandatory), R-05 (undocumented semantics → spike T-001).
