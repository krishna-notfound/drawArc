# F12 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The workspace navbar `shareSlot` shall render a "Share" button (`Share2` icon + text, `aria-label="Share project"`) for every role; clicking opens the Share dialog (`rounded-3xl`, title "Share project"). | must | PRD-010, US-1, US-5 | AC-001 |
| FR-002 | For `role === 'owner'` the dialog shall show the invite form, editable role controls, and remove buttons; for `editor`/`viewer` it shall show the member list and "Copy link" only, with description "People with access to this project." and no mutation controls in the DOM. | must | PRD-010, US-5 | AC-002, AC-003 |
| FR-003 | The invite form shall have an email `Input` (label "Email", placeholder "name@example.com", `type="email"`, `maxLength=254`), a role `Select` (options "Editor", "Viewer"; default "Editor"), and an "Invite" button; Enter in the email field submits; submit is disabled while pending. | must | PRD-010 | AC-004, AC-005 |
| FR-004 | The member list shall render the owner first (avatar, name or email, badge "Owner"), then members ordered by `invitedAt`; bound members show `User.name`/`avatarUrl` (initials fallback), pending members show the email with badge "Pending"; each row shows the role ("Editor"/"Viewer"). | must | PRD-010, US-2 | AC-006 |
| FR-005 | Owner role control: a per-row `Select` that calls `changeMemberRole({ projectId, memberId, role })`; the row shows a spinner while pending; on `NOT_FOUND` the banner "This member was already removed." is shown and the list refreshes. | must | PRD-010, US-3 | AC-007 |
| FR-006 | Owner remove control: a button `aria-label="Remove {name or email}"` that switches the row to an inline confirmation ("Remove {name or email}?" with "Remove" (destructive) and "Cancel"); confirm calls `removeMember({ projectId, memberId })`. | must | PRD-010, US-3 | AC-008 |
| FR-007 | "Copy link" shall write `${origin}/editor/${projectId}` to the clipboard and change its label to "Copied!" for 2 s; if the clipboard API rejects, it shall reveal a read-only input containing the URL with the text "Couldn't copy — select the link below". | must | reference 09 | AC-009 |
| FR-008 | `listProjectMembers(projectId)` shall be a `'use cache'` function (`cacheLife('minutes')`, `cacheTag('project:{id}:members')`) returning `{ owner, members }` with no email of a *bound* member exposed beyond what the list shows (email is shown for all rows to the owner; for non-owners, bound members show name only — see UX). It performs no authorization; the server page calls it only after the F04 gate. | must | D-026, security-model rule 4 | AC-010, AC-011 |
| FR-009 | `inviteMember` shall: require role `owner`; reject `ARCHIVED` with `CONFLICT`/`PROJECT_ARCHIVED`; normalise the email (`trim().toLowerCase()`); reject the owner's own email with `CONFLICT`/`SELF_INVITE`; reject an existing `(projectId, email)` with `CONFLICT`/`DUPLICATE_MEMBER` (also when the race is caught as Prisma `P2002`); enforce ≤ 20 invitations per inviter per rolling hour (`RATE_LIMITED`); bind `userId`/`acceptedAt` when a non-deleted `User` with that email exists; `updateTag('project:{id}:members')` and, if bound, `updateTag('projects:shared:{userId}')`; return the created `MemberListItem`. | must | PRD-010, PRD-011, security-model "Invitations" | AC-012, AC-013, AC-014, AC-015 |
| FR-010 | `changeMemberRole` shall require role `owner`; reject `ARCHIVED` (`CONFLICT`/`PROJECT_ARCHIVED`); load the member scoped by `(id, projectId)` else `NOT_FOUND`; if the role is unchanged return `ok` without side effects; otherwise update the row, `updateTag` members (+ shared list if bound), and if bound call `broadcastRoleChanged(projectId, userId, role)` → F05 `notifyRoleChanged` → `ROLE_CHANGED { userId, role }` (D-030). | must | PRD-013, D-030 | AC-016, AC-017 |
| FR-011 | `removeMember` shall require role `owner` (archived allowed, D-033); load scoped else `NOT_FOUND`; delete the row; `updateTag` members (+ shared list if bound); if bound call `broadcastKick(projectId, userId)` → F05 `kickUser` → `KICK { userId }`. | must | PRD-013 | AC-018, AC-019 |
| FR-012 | `broadcastKick` / `broadcastRoleChanged` shall run **after** the Postgres write commits and delegate to F05's `kickUser` / `notifyRoleChanged` (which retry once and log at `error` level with `{ projectId, userId, op }` on final failure, returning `false`); the action sets `data.kickDelivered` to that boolean (the DB change stands either way). | must | security-model "Revocation", R-03, F05/FR-003 | AC-020 |
| FR-013 | `checkMyAccess({ projectId })` shall require a session (`requireUser()`, default `'throw'`), call `getProjectRole`, and return `{ role }` or `FORBIDDEN` (identical for missing/foreign ids). | must | D-032 | AC-021 |
| FR-014 | `useKickListener({ projectId, currentUserId, role })` (the hook behind F05's `components/editor/kick-listener.tsx`) shall, on a `KICK` or `ROLE_CHANGED` event whose `userId === currentUserId`: render the overlay "Your access to this project was changed by the owner. Reloading…" (`role="status"`), call `useUnloadGuard().suppress()` (F05), call `client.logout()`, and `window.location.reload()` within 500 ms. Events for other users are ignored. | must | PRD-013, D-031, F05/FR-013, F05/FR-014 | AC-022, AC-023 |
| FR-015 | After the reload: a removed user lands on AccessDenied (F04 gate); a re-roled user lands on the workspace with the new `role` prop and a new token (`*:read` for viewer, `*:write` for editor) issued by F05's auth route; the KICK/ROLE_CHANGED → AccessDenied/new-role path completes ≤ 5 s after the owner's confirm. | must | PRD-013, M1 acceptance step 6 | AC-024, AC-025 |
| FR-016 | On every Liveblocks status transition `reconnecting → connected` (F05's `onReconnected` hook point), the hook shall call `checkMyAccess({ projectId })`; if the result is not `ok` or `role` differs from the prop, it shall take the same path as a `KICK` (D-032). | must | US-6, R-03, F05/FR-014 | AC-026 |
| FR-017 | A pending (unbound) member who signs in with the invited email shall see the project under "Shared with me" and open it with the invited role, without any owner action (binding by F02 in both the lazy upsert and the `user.created` webhook paths). | must | PRD-011, US-4 | AC-027 |
| FR-018 | Non-owner callers of `inviteMember`/`changeMemberRole`/`removeMember` (viewer, editor, non-member on existing or missing id) shall receive the identical `FORBIDDEN` result; unauthenticated callers `UNAUTHENTICATED`. | must | NFR-001, US-8 | AC-028 |
| FR-019 | The dialog shall map errors: `VALIDATION`/`CONFLICT` with field `email` → inline under the email input; `RATE_LIMITED` → banner "You've sent too many invitations. Try again in an hour."; `PROJECT_ARCHIVED` → banner "This project is archived. Unarchive it to manage sharing."; `kickDelivered === false` → warning banner "Access updated, but they may stay connected until they reload."; other → banner with the server message. | must | code-standards rule 8 | AC-029 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Four actions, each `requireUser` → Zod → `requireProjectRole(projectId, 'owner')` (or `getProjectRole` for `checkMyAccess`); AUTHZ-MATRIX in 05-test-plan.md. |
| NFR-002 | `schemas/member.ts` for every input; member ids validated as cuid; emails as RFC-shaped strings ≤ 254. |
| NFR-003 | Share dialog data is server-rendered with the workspace (no extra round trip); actions return in one round trip with the re-rendered list. |
| NFR-006 | Dialog traps focus; every control labelled; role `Select` keyboard-operable; overlay uses `role="status"`. |
| NFR-009 | KICK failures and rate-limit hits logged with `projectId`, `userId`, `op`. |

## UX and interaction behaviour

| Element | Owner view | Editor/viewer view |
|---|---|---|
| Description | "Invite people by email. They'll see this project under Shared with me after they sign in." | "People with access to this project." |
| Invite form | shown | absent |
| Owner row | avatar · name (or email) · "Owner" badge | same |
| Bound member row | avatar · name · email (muted, `text-copy-muted`) · role `Select` · remove | avatar · name · role text |
| Pending row | initials from email · email · "Pending" badge · role `Select` · remove | email · "Pending" · role text |
| Footer | "Copy link" · "Done" | "Copy link" · "Done" |
| Pending states | per-row spinner, controls disabled for that row; invite button "Inviting…" | — |
| Success feedback | row appears with "Pending"/name; email input cleared, focus returns to it | — |
| Empty members | "No one else has access yet." | "No one else has access yet." |

Roles vocabulary in UI: "Editor" / "Viewer" / "Owner" (glossary). Icons: `Share2`, `UserPlus`, `X`, `Link` (lucide). Relative time is not shown in M1.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Owner invites own email (any case) | `CONFLICT`/`SELF_INVITE` inline "You already own this project." | AC-013 |
| EC-002 | Owner invites an existing member's email | `CONFLICT`/`DUPLICATE_MEMBER` inline "{email} already has access." | AC-013 |
| EC-003 | Two tabs invite the same email concurrently | one `ok`, one `CONFLICT` (P2002 mapped); exactly one row | AC-014 |
| EC-004 | 21st invitation within an hour (across all the owner's projects) | `RATE_LIMITED`; no row; logged. Removed rows no longer count (accepted limitation: invite/remove churn can exceed 20 effective invites) | AC-015 |
| EC-005 | Invitee is mid-sign-up: User row absent at invite, created moments later by webhook or lazy upsert | row stored pending; F02 binds on either path; first `/editor` shows the project | AC-027 |
| EC-006 | Invitee's Clerk primary email differs in case or later changes | compare lowercase; email change re-binds via F02 webhook (F02 responsibility) | AC-012 |
| EC-007 | Owner changes B's role while B's share dialog is open | B's list is stale until B's ROLE_CHANGED-triggered reload; after reload it shows the new role | AC-024 |
| EC-008 | Two owner tabs remove the same member | second gets `NOT_FOUND` "This member was already removed."; list refreshes | AC-019 |
| EC-009 | `broadcastEvent` fails twice | DB change persists; `kickDelivered: false`; warning banner; error log | AC-020 |
| EC-010 | B is offline when KICK is broadcast (`context.setOffline(true)`), then reconnects | event missed; reconnect triggers `checkMyAccess` → mismatch → logout + reload → AccessDenied | AC-026 |
| EC-011 | B has unsynced local edits when KICK arrives | unsaved-changes prompt suppressed; edits discarded (they would be rejected anyway); reload proceeds | AC-023 |
| EC-012 | KICK or ROLE_CHANGED for another user arrives | ignored; no UI change | AC-022 |
| EC-013 | Role changed to the same role | `ok`, no ROLE_CHANGED broadcast, no tag update | AC-016 |
| EC-014 | Owner on an archived project opens the dialog | invite form and role selects disabled with hint "Archived projects can't be shared."; remove still works (D-033); server enforces both | AC-012, AC-018 |
| EC-015 | Non-member/editor calls an action directly (devtools) | `FORBIDDEN`, identical body for missing/foreign ids | AC-028 |
| EC-016 | Clipboard permission denied / insecure context | fallback read-only input (FR-007) | AC-009 |
| EC-017 | Member list contains a user with `deletedAt` set | F02's `user.deleted` removes memberships; defensively `listProjectMembers` renders such rows as pending by email | AC-010 |
| EC-018 | Owner removes a member who is on `/editor` (not in the room) | no KICK is received (not in room); their shared list tag is updated so the next render omits the project; opening the URL → AccessDenied | AC-018 |
| EC-019 | Project deleted while the dialog is open | next action → `FORBIDDEN` (project gone, identical to non-member); F03's delete also KICKs members | AC-028 |
| EC-020 | Email with surrounding whitespace or uppercase | stored lowercase; row displays lowercase | AC-012 |
