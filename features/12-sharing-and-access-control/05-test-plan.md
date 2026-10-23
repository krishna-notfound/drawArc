# F12 — Test Plan

Layers per `context/testing-strategy.md`. L2: Neon test branch, `requireUser` seam (`asUser`/`asAnonymous`), `next/cache` stub recording `updateTag`/`cacheTag`, and `lib/liveblocks.ts` replaced by a spy object `{ broadcastEvent: vi.fn() }` (the seam is the module, not the SDK internals). L3: two Clerk contexts, Liveblocks dev server (`--no-persist`), `playwright.config.ts` projects `desktop` and (for AC-030) the axe fixture. Timing assertions use `expect.poll` with a 5 000 ms timeout for PRD-013.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L3 | `tests/e2e/sharing.spec.ts` | A owns P; B editor; C viewer | each opens `/editor/{P}`, clicks "Share project" | dialog "Share project" for all three |
| TC-002 | AC-002 | L1 | `tests/unit/share-dialog.test.tsx` | `role 'owner'`, fixture members | render | invite form, selects, remove buttons present |
| TC-003 | AC-003 | L1 | `tests/unit/share-dialog.test.tsx` | `role 'editor'` then `'viewer'` | render | description copy; no invite/select/remove; "Copy link", "Done" |
| TC-004 | AC-004 | L1 | `tests/unit/share-dialog.test.tsx` | owner | inspect inputs | label/placeholder/type/maxLength; default "Editor", option "Viewer" |
| TC-005 | AC-005 | L1 | `tests/unit/share-dialog.test.tsx` | `inviteMember` mock 200 ms | Enter + click within 50 ms | one call; "Inviting…" disabled; cleared + focused after |
| TC-006 | AC-006 | L1 | `tests/unit/member-row.test.tsx` | owner A, bound B, pending c@x.io | render list | order, badges, avatar/initials, roles |
| TC-007 | AC-007 | L1 | `tests/unit/member-row.test.tsx` | `changeMemberRole` mock; then NOT_FOUND mock | change select | call args; spinner; banner copy |
| TC-008 | AC-008 | L1 | `tests/unit/member-row.test.tsx` | owner | click remove; Cancel; click remove; Remove | inline confirm; restore; action called |
| TC-009 | AC-009 | L1 | `tests/unit/share-dialog.test.tsx` | clipboard stub resolve / reject; fake timers | click "Copy link" | URL written; "Copied!" 2 s; fallback input + copy |
| TC-010 | AC-010 | L2 | `tests/integration/members-list.test.ts` | A, B bound, pending c, member bound to deleted user | `listProjectMembers(P)` | owner A; 3 members ordered; statuses; tag recorded |
| TC-011 | AC-011 | Manual | reviewer | — | read `lib/projects/members.ts`, gate file | no authz in list fn; called after gate; excerpts in status.md |
| TC-012 | AC-012 | L2 | `tests/integration/member-actions.test.ts` | `asUser(A)`; P active, then archived | `inviteMember` with padded uppercase email; repeat on archived | lowercase row, pending, members tag only; `PROJECT_ARCHIVED` |
| TC-013 | AC-013 | L2 | `tests/integration/member-actions.test.ts` | A email `a@x.io`; existing member | invite `A@X.IO`; invite existing | `SELF_INVITE`; `DUPLICATE_MEMBER`; row count unchanged |
| TC-014 | AC-014 | L2 | `tests/integration/member-actions.test.ts` | — | `Promise.all` two invites same email | one ok, one `DUPLICATE_MEMBER`; one row |
| TC-015 | AC-015 | L2 | `tests/integration/member-actions.test.ts` | 20 rows `invitedById A` in last hour across 2 projects; variant with one at −61 min; existing user B | invite 21st; invite after ageing; invite B's email | `RATE_LIMITED`; ok; bound row + shared tag for B |
| TC-016 | AC-016 | L2 | `tests/integration/member-actions.test.ts` | B bound editor; `lib/liveblocks.ts` spy | change to editor; change to viewer | no-op; then row VIEWER, tags, one `notifyRoleChanged(P, B.id, 'viewer')` after write; `kickUser` not called |
| TC-017 | AC-017 | L2 | `tests/integration/member-actions.test.ts` | pending member; archived P; foreign memberId | three calls | ok no broadcast; `PROJECT_ARCHIVED`; `NOT_FOUND` |
| TC-018 | AC-018 | L2 | `tests/integration/member-actions.test.ts` | B bound; P archived variant | `removeMember` | row gone; tags; `kickUser(P, B.id)` once; archived ok |
| TC-019 | AC-019 | L2 | `tests/integration/member-actions.test.ts` | B already removed | `removeMember` again | `NOT_FOUND`; no broadcast |
| TC-020 | AC-020 | L2 | `tests/integration/member-actions.test.ts` | spy `kickUser`/`notifyRoleChanged` resolve `false`; then `true` | `removeMember`; `changeMemberRole` | row changed; `kickDelivered false`; then `true` |
| TC-021 | AC-021 | L2 | `tests/integration/authz-matrix.members.test.ts` | A, B, C, D; missing id | `checkMyAccess` ×5 | roles; identical FORBIDDEN ×2 |
| TC-022 | AC-022 | L1 | `tests/unit/use-kick-listener.test.tsx` | mocked `useEventListener`, `useStatus`, `useClient`, `useUnloadGuard`, `location.reload` stub; fake timers | emit KICK u2; ROLE_CHANGED u2; KICK u1; (fresh render) ROLE_CHANGED u1 | first two ignored; `kicked`, suppress → logout → reload order, ≤ 500 ms, for both self events |
| TC-023 | AC-023 | L3 | `tests/e2e/sharing.spec.ts` | A, B editor in room | A removes B; capture dialogs on B | overlay text visible; zero `beforeunload` dialogs |
| TC-024 | AC-024 | L3 | `tests/e2e/sharing.spec.ts` | A, B editor in room; `t0` at A's select change | poll B's `data-role`, `data-can-write` | `viewer`/`false` within 5 s; (F06) drag has no effect — `test.fixme` until F06 |
| TC-025 | AC-025 | L3 | `tests/e2e/sharing.spec.ts` | A, B in room; `t0` at A's "Remove" confirm | poll B page for "You can't open this project"; evaluate status; B goto P; B goto `/editor` | ≤ 5 s; status not `connected`; AccessDenied; P absent from sidebar |
| TC-026 | AC-026 | L3 | `tests/e2e/sharing.spec.ts` | B editor in room | `B.context.setOffline(true)`; A removes B; wait 3 s; `setOffline(false)` | AccessDenied within 10 s of reconnect; overlay seen |
| TC-027 | AC-027 | L3 | `tests/e2e/sharing.spec.ts` | B's `User` row deleted by factory; B signed out | A invites B's email as editor; B signs in; B `/editor`; B opens P; A reloads dialog | "Shared with me (1)"; workspace `data-role="editor"`; A sees B's name, no "Pending" |
| TC-028 | AC-028 | L2 | `tests/integration/authz-matrix.members.test.ts` | anonymous; D with foreign/missing id; C viewer; B editor; A owner | 3 actions × 6 callers | codes per matrix; failures leave rows unchanged |
| TC-029 | AC-029 | L1 | `tests/unit/share-dialog.test.tsx` | six mocked results | trigger each | exact copy/placement per AC-029 |
| TC-030 | AC-030 | L3 | `tests/e2e/sharing.spec.ts` | owner dialog open | Tab cycle; Esc; axe | focus trapped/returned; no serious/critical |

## AUTHZ-MATRIX (mandatory)

| Action | unauthenticated | non-member (foreign id) | non-member (missing id) | viewer | editor | owner |
|---|---|---|---|---|---|---|
| `inviteMember` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` (identical) | `FORBIDDEN` | `FORBIDDEN` | ok (`CONFLICT` if archived) |
| `changeMemberRole` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok (`CONFLICT` if archived) |
| `removeMember` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok (also when archived) |
| `checkMyAccess` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `{ role: 'viewer' }` | `{ role: 'editor' }` | `{ role: 'owner' }` |
| Liveblocks auth (F05, re-run after KICK / ROLE_CHANGED reload) | 401 | 403 | 403 | `*:read` | `*:write` | `*:write` |

Email-only binding case: TC-027 (L3) and F03 TC-005/TC-008 (L2).

## Collaboration / concurrency cases (mandatory — touches the room)

- Downgrade while connected → read token within 5 s (TC-024).
- Removal while connected → ejected ≤ 5 s, cannot rejoin (TC-025).
- Removal while offline → verified on reconnect (TC-026).
- Removal with unsynced local edits → no unload prompt (TC-023; the "edits exist" precondition needs F06 and is `fixme` until then).
- Concurrent invites of one email (TC-014); double removal from two owner tabs (TC-019 at L2; L3 variant not automated — same server path).
- Owner deletes the project while B is in the room — F03/TC-020 (uses F05's kick listener with this feature's `useKickListener`).

## Not tested automatically (and why)

- Liveblocks token TTL expiry behaviour (UNVERIFIED and unobservable from tests); the design does not depend on it.
- Whether `deleteRoom`/reconnect re-call the auth endpoint: covered behaviourally by TC-025/TC-026 outcomes rather than by observing the auth call.
- Visual layout of the dialog against `ui-context.md`: manual check on the preview URL, screenshot path in status.md.
- Rate-limit churn (invite/remove loops beyond 20 effective invites): accepted limitation, documented in EC-004.
- Clerk email-change re-binding: F02's test plan.
