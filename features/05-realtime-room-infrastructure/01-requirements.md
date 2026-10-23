# F05 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The system shall install `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/react-ui`, `@liveblocks/react-flow`, `@liveblocks/node` pinned to exactly `3.24.4` (no caret/tilde), and a unit test shall fail if any two differ. | must | NFR-010, D-023 | AC-001 |
| FR-002 | `types/liveblocks.config.ts` shall declare the global `Liveblocks` interface exactly as in `context/domain-model.md` "Liveblocks room shape", plus the PROPOSED `ROLE_CHANGED` event (P-05-2). | must | domain-model | AC-002 |
| FR-003 | `lib/liveblocks.ts` shall export a cached `Liveblocks` node client and the helpers `ensureRoom`, `deleteRoom`, `kickUser`, `notifyRoleChanged`, `userColor` with the signatures in `02-design.md`. | must | US-4, F12, F03 | AC-003, AC-004 |
| FR-004 | `userColor(userId)` shall map any user id deterministically to one of `USER_COLORS`; equal ids give equal colours across server and client. | must | PRD-031 (F11 consumer) | AC-004 |
| FR-005 | `POST /api/liveblocks-auth` shall: reject a `room` that is not a cuid; `requireUser`; `requireProjectRole(room, 'viewer')`; `prepareSession(user.id, { userInfo: { name, avatar, color } })`; `allow(room, role === 'viewer' ? ['*:read'] : ['*:write'])`; return `authorize()`'s body and status. | must | PRD-012, NFR-001, security-model | AC-005, AC-006, AC-007 |
| FR-006 | When the caller is unauthenticated, a non-member, or sends an invalid room id, the auth route shall respond with body `{ error: 'forbidden', reason }` (status 401 for unauthenticated, 403 otherwise) so the Liveblocks client stops retrying; identical body for "no membership" and "project does not exist". | must | security-model, R-03 | AC-007 |
| FR-007 | The auth route shall never be cached (`'use cache'` forbidden, no segment config exports) and shall emit `Cache-Control: no-store`. | must | code-standards rule 2 | AC-008 |
| FR-008 | `GET /api/users/resolve?ids=a,b` shall require a user, accept 1–50 cuids, and return `{ users: [{ id, name, avatar }] }` only for users who share at least one project with the caller (as owner or member). | must | P-05-4, NFR-001 | AC-009 |
| FR-009 | `components/editor/project-room.tsx` shall render `LiveblocksProvider` (`authEndpoint: '/api/liveblocks-auth'`, `throttle: 50`, `lostConnectionTimeout: 5000`, `preventUnsavedChanges: true`, `resolveUsers` → FR-008, `baseUrl` from `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` when set) → `RoomProvider id={projectId} initialPresence={{ cursor: null, thinking: false }}` → `ClientSideSuspense` with a loading fallback. | must | PRD-030, PRD-032 | AC-010, AC-011 |
| FR-010 | A room error boundary shall map `useErrorListener` codes -1 and 4001 → "You no longer have access" + navigate `/editor`; 4005 → "This project is full (10 people)"; 4006 → reload; any other → generic retry fallback. No blank screen. | must | PRD-041, R-02 | AC-012 |
| FR-011 | A connection-status pill shall show "Reconnecting…" (`reconnecting`/`connecting`), "Disconnected" (`disconnected`), "Syncing…" (`synchronizing`) and be hidden when `connected` + `synchronized`; `useLostConnectionListener` shall toast on `lost`/`restored`/`failed`. | must | PRD-032 | AC-013, AC-014 |
| FR-012 | With unsynced changes, closing the tab shall trigger the browser `beforeunload` prompt (`preventUnsavedChanges: true`); `ProjectRoom` shall expose `useUnloadGuard().suppress()` so the kick listener (and F12's reconnect re-verification) can bypass the prompt for a forced reload. | must | PRD-032, F12 D-031 | AC-015 |
| FR-013 | On `KICK` whose `userId === useSelf().id`, `components/editor/kick-listener.tsx` shall render the overlay "Your access to this project was changed by the owner. Reloading…" (`role="status"`), call `useUnloadGuard().suppress()`, call `client.logout()` (purges cached tokens), and `window.location.reload()` within 500 ms; after the reload the F04 gate renders AccessDenied (removal) — the client never navigates elsewhere itself. Other users ignore the event. End-to-end ≤ 5 s from broadcast. | must | PRD-013, R-03, security-model "Revocation", D-031 | AC-016 |
| FR-014 | On `ROLE_CHANGED` whose `userId === useSelf().id`, the same listener shall take the identical overlay → `suppress()` → `client.logout()` → `window.location.reload()` path; after the reload the gate passes the new `role` prop and the auth route issues `['*:read']` (viewer) or `['*:write']` (editor). The listener also exposes the hook point `onReconnected(cb)` (fires on every `reconnecting → connected` transition) that F12 fills with `checkMyAccess` (D-032); F05 ships it with no callback registered. | must | PRD-013, P-05-2, D-031, D-032 | AC-017 |
| FR-015 | `POST /api/webhooks/liveblocks` shall verify with `WebhookHandler.verifyRequest({ headers, rawBody: await request.text() })`, return 400 with no side effects on failure, log `roomCreated`/`userEntered`/`userLeft`/`storageUpdated` with `projectId`=roomId, and return 200 for every verified event (unknown types included). | must | security-model, R-08 | AC-018, AC-019 |
| FR-016 | `lib/env.ts` shall validate `LIVEBLOCKS_SECRET_KEY` (starts `sk_`), `LIVEBLOCKS_WEBHOOK_SECRET_KEY` (starts `whsec_`), optional `LIVEBLOCKS_BASE_URL` and `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` (URL); `.env.example` lists them. | must | NFR-008 | AC-020 |
| FR-017 | The root `playwright.config.ts` (F00) shall, with `E2E_LIVEBLOCKS=1`, start the Liveblocks dev server (`npx liveblocks dev --no-persist --no-check`, port 1153) beside the app on port 3000 (no second config file, no other port), the app receiving `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL`/`LIVEBLOCKS_BASE_URL=http://localhost:1153`; F05 adds a `twoUsers` fixture (two `browser.newContext` with distinct Clerk `storageState`) and a smoke test showing both users `connected` in the same room. | must | D-017, NFR-003, F00/FR-007 | AC-021 |
| FR-018 | A spike shall record, in `status.md`, verified answers for: (a) `mutateStorage`/`mutateFlow` visibility of changes before/after `await`; (b) `mutateFlow.updateNode(partial)` merge depth; (c) viewport not synced by `useLiveblocksFlow`; (d) whether `onNodesChange([{ type: 'add', item }])` creates a node in Storage; (e) whether the dev server accepts tokens from our auth route (`sk_*` + `baseUrl`), else fallback; (f) whether `deleteStorageDocument` works against the dev server. | must | R-05 | AC-022 |
| FR-019 | `ensureRoom(projectId)` shall be called from the F03 create-project action after the Postgres insert and `deleteRoom(projectId)` from the delete action after the cascade; both best-effort, failures logged with `projectId`, never failing the user action. | should | PRD-003, invariant 7 | AC-023 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Token permissions derive from `requireProjectRole` on every auth call; room id from the body is only an argument to it. `resolve` is scoped to shared projects. |
| NFR-002 | Auth body, resolve query, and webhook payload are Zod-parsed (webhook after signature verification). |
| NFR-003 | Token issuance ≤ 300 ms p95 locally (one DB round-trip); measured in TC-007. |
| NFR-007 | Global `Liveblocks` interface makes every hook strictly typed; no `any`. |
| NFR-008 | `LIVEBLOCKS_SECRET_KEY` and webhook secret are server-only in `lib/env.ts`; only `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` reaches the bundle. |
| NFR-009 | Auth denials and webhook events logged with `userId`, `projectId`, `requestId`. |
| NFR-010 | Exact `3.24.4` pins; `npm audit` in CI. |

## UX and interaction behaviour

- Loading fallback (inside `ClientSideSuspense`): full-viewport `bg-base` with a centred muted "Connecting to project…" text and the dot pattern placeholder; no card.
- Status pill: top-right, left of the avatar stack slot (F11), `rounded-xl`, `bg-elevated`, text + icon (never colour only): `Reconnecting…` (warning), `Disconnected` (error, with "Retry" button calling `room.reconnect()`), `Syncing…` (muted). Hidden when healthy. Respects `prefers-reduced-motion` (no spinner animation).
- Toasts (shadcn `sonner`, generated here as `components/ui/sonner.tsx` — F14 reuses it): "Connection lost — your changes will sync when you're back online", "Connection restored", "Could not reconnect. Reload the page.".
- Access-change overlay (KICK / ROLE_CHANGED for self): full-viewport `bg-base/80` layer, `role="status"`, text "Your access to this project was changed by the owner. Reloading…"; shown for ≤ 500 ms before the reload. No toast survives the reload by design; the reloaded page explains the outcome (AccessDenied copy, or the workspace with the new role).
- Error fallback: centred panel with title, explanation, and one primary action (Back to projects / Reload / Retry). Room-full copy: "This project already has 10 people connected. Ask someone to leave or try again later."
- Keyboard: all fallback actions are buttons with visible focus (NFR-006).

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Auth body `room` missing or not a cuid | 403 `{ error: 'forbidden', reason: 'invalid_room' }`, no DB query | AC-007 |
| EC-002 | Project deleted while a user is connected | Next auth refresh → 403 forbidden → error boundary "no longer have access" → `/editor` | AC-012 |
| EC-003 | Member removed while editing (R-03) | KICK → `client.logout()` + reload within 5 s → gate renders AccessDenied; `/editor/[id]` keeps showing AccessDenied | AC-016 |
| EC-004 | Role downgraded mid-session | ROLE_CHANGED → `client.logout()` + reload → read token → F06 read-only mode; the unload prompt is suppressed (`useUnloadGuard().suppress()`), so unsynced local edits are discarded (they would be rejected anyway) | AC-017 |
| EC-005 | Room full (11th connection, R-02) | Error 4005 → room-full fallback; no retry loop | AC-012 |
| EC-006 | Network drops > 5 s then returns | pill `Reconnecting…` → toast lost → restored; queued edits replay (verified in F06 TC) | AC-013, AC-014 |
| EC-007 | Network never returns | `failed` → "Could not reconnect" fallback with Reload | AC-014 |
| EC-008 | Tab closed with unsynced changes | native `beforeunload` prompt | AC-015 |
| EC-009 | Webhook with bad signature / replayed timestamp | 400, nothing logged as an event, no DB writes | AC-019 |
| EC-010 | Webhook event type we do not handle | 200 (so Liveblocks does not retry/disable the endpoint) | AC-018 |
| EC-011 | `resolve` asked for 51 ids or a non-cuid | 400 `VALIDATION` | AC-009 |
| EC-012 | `resolve` asked for a user not sharing any project | id omitted from `users` (no error, no leak) | AC-009 |
| EC-013 | KICK received by a different user | ignored; no overlay, no reload | AC-016 |
| EC-014 | Two tabs of the same user; one is kicked | both receive KICK (event is room-wide) and both reload to AccessDenied | AC-016 |
| EC-017 | Client offline when KICK/ROLE_CHANGED was broadcast | event missed; on `reconnecting → connected` the `onReconnected` hook fires — F12 registers `checkMyAccess` there (D-032); F05 alone only re-derives the token on the next auth call | AC-017 (hook point exists), F12/AC-026 |
| EC-015 | `ensureRoom` fails at project creation | project still created; `logger.error` with `projectId`; room auto-creates on first join | AC-023 |
| EC-016 | Liveblocks API unreachable from the auth route | 502 `{ error: { code: 'UPSTREAM' } }`; client retries (not forbidden body) | AC-005 |
