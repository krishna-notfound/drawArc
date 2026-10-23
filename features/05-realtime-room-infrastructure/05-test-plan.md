# F05 — Test Plan

Layers and commands are those in `context/testing-strategy.md`. L2 runs against the Neon test branch (`DATABASE_URL_TEST`) with Clerk mocked at the `requireUser` seam; L3 runs against the Liveblocks dev server (`pk_localdev`, port 1153) and a Clerk dev instance with E2E users A and B.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/deps/liveblocks-pin.test.ts` | read `package.json` | collect all `@liveblocks/*` entries | all equal `'3.24.4'`; no `^`/`~` |
| TC-002 | AC-002 | L0 | `tests/unit/types/liveblocks-config.type-test.ts` | — | `expectTypeOf<Liveblocks['Presence']>().toEqualTypeOf<…>()`, the same for `UserMeta['info']` and `RoomEvent` | `tsc --noEmit` passes; a deliberate mismatch fails |
| TC-003 | AC-003 | L1 | `tests/unit/lib/liveblocks.test.ts` | `vi.mock('@liveblocks/node')` | call `getLiveblocks()` ×2; make `getOrCreateRoom`/`deleteRoom`/`broadcastEvent` reject; call helpers | same instance; helpers resolve; `logger.error` called with `projectId` |
| TC-004 | AC-004 | L1 | `tests/unit/lib/user-color.test.ts` | 1,000 cuids from `tests/factories.ts` | `userColor` twice each; histogram | deterministic; ∈ `USER_COLORS`; max bucket ≤ 25 % |
| TC-005 | AC-005 | L2 | `tests/integration/api/liveblocks-auth.test.ts` | `makeUser` ×3, `makeProject(owner)`, `makeMember(editor)`, `makeMember(viewer)` | POST `{ room }` as each; decode token | 200; `uid`; `userInfo.color`; perms `*:write`/`*:write`/`*:read` |
| TC-006 | AC-006 | L2 | same | member row with `userId: null`, email = caller email | POST | 200; row now has `userId`, `acceptedAt` |
| TC-007 | AC-007 (AUTHZ-MATRIX) | L2 | same | as TC-005 plus stranger | POST unauthenticated / stranger / random cuid / `'nope'` | 401 / 403 / 403 / 403 with forbidden body; stranger and random bodies identical; Prisma spy = 0 calls for `'nope'`; p95 of 20 valid calls < 300 ms |
| TC-008 | AC-008 | L2 | same | — | grep route source; inspect headers | no cache directives; `Cache-Control: no-store` |
| TC-009 | AC-009 (AUTHZ-MATRIX) | L2 | `tests/integration/api/users-resolve.test.ts` | C owns P1 (member U1); C member of P2 (owner U2); U3 stranger | GET as C with `ids=U1,U2,U3`; 51 ids; unauthenticated | `{ users: [U1, U2] }`; 400; 401 |
| TC-010 | AC-011 | L1 | `tests/unit/components/project-room.test.tsx` | `vi.mock('@liveblocks/react/suspense')` capturing props | render `<ProjectRoom>` with/without `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` | prop values as specified; `baseUrl` undefined when unset |
| TC-011 | AC-012 | L1 | `tests/unit/components/room-fallbacks.test.tsx` | mocked `useErrorListener`, `next/navigation` router, `location.reload` | emit -1, 4001, 4005, 4006, 9999 | fallback copy per code; `replace('/editor')` for -1/4001; reload for 4006; Retry button works |
| TC-012 | AC-014 | L1 | `tests/unit/components/connection-status.test.tsx` | mocked `useStatus`/`useSyncStatus`/`useLostConnectionListener` | drive each state; emit lost/restored/failed | pill text/visibility; exact toasts; `role="status"` |
| TC-013 | AC-010, AC-021 | L3 | `tests/e2e/room-smoke.spec.ts` | `twoUsers` fixture; project created via API as A; B seeded editor | both goto `/editor/[P]` | loading text seen; both pills `data-connection-status="connected"` ≤ 10 s; WS URL contains `roomId=P` |
| TC-014 | AC-013 | L3 | `tests/e2e/connection-status.spec.ts` | A connected | `contextA.setOffline(true)`; wait 6 s; `setOffline(false)` | "Reconnecting…" ≤ 1 s; hidden ≤ 5 s after reconnect; no console errors |
| TC-015 | AC-015 | L3 | `tests/e2e/connection-status.spec.ts` | A offline, one Storage change via F06 dev affordance (`data-testid="dev-add-node"`) | `page.goto('/editor')` with dialog listener | `beforeunload` dialog observed (test skipped with reason until F06 T-006 lands) |
| TC-016 | AC-016 | L3 | `tests/e2e/kick.spec.ts` | A, B connected; B has a second tab; `page.on('dialog')` recorder on B | delete B's member row (factory); helper `kickUser(P, B.id)` | both B pages show the overlay then reload to AccessDenied ≤ 5 s; `client.logout` spy called before navigation; zero `beforeunload` dialogs; A unchanged |
| TC-017 | AC-017 | L3 | `tests/e2e/kick.spec.ts` | B editor | update member row to VIEWER (factory) then `notifyRoleChanged(P, B.id, 'viewer')`; then `notifyRoleChanged(P, A.id, 'viewer')` while observing B | B reloads ≤ 5 s; intercepted auth response has `*:read`; root `data-role="viewer"`, `data-can-write="false"`; B does not reload for A's event |
| TC-017b | AC-017b | L1 | `tests/unit/components/kick-listener.test.tsx` | mocked `useStatus` sequence | register a callback; drive status transitions | called exactly twice; not on initial connect |
| TC-018 | AC-018 | L2 | `tests/integration/api/webhooks-liveblocks.test.ts` | sign body with test `whsec_` using the SDK's HMAC scheme | POST `userEntered`; POST `{ type: 'somethingNew' }` | 200 + log; 200 no event log |
| TC-019 | AC-019 (AUTHZ-MATRIX) | L2 | same | wrong secret; stale `webhook-timestamp` | POST | 400; no event log; no DB writes |
| TC-020 | AC-020 | L1 | `tests/unit/lib/env.test.ts` | `vi.stubEnv` | load with bad prefix / missing key / valid | throws naming key; loads; `.env.example` has 4 keys |
| TC-021 | AC-023 | L2 | `tests/integration/actions/projects-room-lifecycle.test.ts` | spy on `lib/liveblocks` | create project; make `ensureRoom` reject; delete project | called after insert; action ok on reject; `deleteRoom` after delete |
| TC-022 | AC-022 | Manual | `scripts/spike-liveblocks.ts` → `status.md` | dev server running | run script; paste output | six answers recorded VERIFIED/UNVERIFIED with evidence |

## Collaboration / concurrency cases (mandatory section)

F05 owns the room but not canvas mutations; the testing-strategy cases map as follows:
- "Owner removes B → B off the canvas within 5 s and `/editor/[id]` shows AccessDenied": TC-016 here (the reload lands on F04's AccessDenied; a further `pageB.goto('/editor/[P]')` is asserted to show it again). The offline-during-KICK case is F12 TC-026 (`checkMyAccess` on reconnect).
- "Disconnect B, B edits, reconnect → B's edits appear for A": requires a Storage mutation → owned by F06 TC; F05 proves the transport half in TC-014.
- The remaining cases (same-node moves, undo LWW, delete during label edit) are owned by F06/F10/F12 and reference the `twoUsers` fixture defined here.

## AUTHZ-MATRIX

| Endpoint | unauthenticated | non-member | viewer | editor | owner | notes |
|---|---|---|---|---|---|---|
| `POST /api/liveblocks-auth` | 401 forbidden-body | 403 forbidden-body | 200 `*:read` | 200 `*:write` | 200 `*:write` | missing project ≡ non-member body; invalid id 403 with zero DB calls (TC-007) |
| `GET /api/users/resolve` | 401 | n/a (scoped by shared projects: unrelated ids omitted) | 200 | 200 | 200 | TC-009 |
| `POST /api/webhooks/liveblocks` | public; signature is the credential | 400 bad signature | — | — | — | TC-018/019 |

## Not tested automatically (and why)

- Real Liveblocks cloud token TTL/expiry behaviour: unpublished (R-03); mitigated by KICK, which is tested.
- Actual 11th-connection rejection (4005): would need 11 authenticated browser contexts; the fallback UI is unit-tested (TC-011) and the limit is a documented product constraint (R-02).
- Webhook delivery from Liveblocks cloud: verified manually once in staging (F15) with the dashboard's "send test event"; signature logic is tested locally (TC-018/019).
- Toast visual placement and reduced-motion rendering: manual check recorded in `status.md`.
