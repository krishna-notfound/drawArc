# F12 — Sharing and access control

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F04 (workspace `shareSlot`, gate, `currentUser` prop), F05 (`lib/liveblocks.ts` node client, `KICK` `RoomEvent`, room provider, auth route deriving `*:read`/`*:write` from `getProjectRole`), F03 (`ProjectMember` model, `requireProjectRole`, `ActionResult`, cache tags), F02 (`requireUser` binds pending members by email) |
| Depended on by | F15 (M1 acceptance run steps 2 and 6), F16/F17 (viewer cannot start runs — reuse `getProjectRole`), F20 (future public links extend `getProjectRole`) |
| Product requirements | PRD-010, PRD-011 (with F02), PRD-012 (with F05), PRD-013 (with F05), PRD-014 |
| Status | see status.md |

## Purpose

F12 lets a project owner share a project by email with role `editor` or `viewer`, change a member's role, and remove a member — and makes those changes take effect in the open Liveblocks room within 5 seconds. It is the last M1 feature in the access chain: F03 defined roles, F04 gated the page, F05 derived room permissions from roles; F12 is where roles change at runtime, so it owns the revocation path (Postgres update → `KICK` broadcast → client re-authentication) that the security model requires because Liveblocks token lifetime is unpublished.

## Problem statement and goals

- Problem: membership lives in Postgres but a connected Liveblocks client holds a token derived from a *past* role. Without an explicit eject-and-re-auth step, a removed or downgraded user keeps the capabilities of their old token for an unknown time (R-03).
- G-1: an owner invites, re-roles, and removes members from one dialog; editors/viewers see a read-only list.
- G-2: an invited email that has no account yet becomes a working membership on first sign-in with no further owner action (PRD-011).
- G-3: after a removal, the removed user's tab leaves the room and shows AccessDenied within 5 s and cannot rejoin; after a downgrade, the user's client re-authenticates and receives a read-only token within 5 s (PRD-013).
- G-4: a member who was offline when the `KICK` was sent cannot resume with a stale token after reconnecting.

## Scope

In scope:
- `components/editor/share-button.tsx` (navbar slot), `components/editor/share-dialog.tsx`, `components/editor/member-row.tsx`, `hooks/useShareDialog.ts`.
- `app/editor/[projectId]/actions.ts`: `inviteMember`, `changeMemberRole`, `removeMember`, `checkMyAccess`.
- `schemas/member.ts` Zod schemas; `lib/projects/members.ts` (`listProjectMembers` `'use cache'`, `countRecentInvites`); `lib/projects/member-service.ts` (cores incl. `broadcastKick`).
- `hooks/useKickListener.ts` (extracted from, and used by, F05's `components/editor/kick-listener.tsx`): F05 already reacts to `KICK`/`ROLE_CHANGED` with `client.logout()` + reload; F12 adds the reconnect re-verification (`checkMyAccess` registered on F05's `onReconnected` hook point) and the shared overlay copy. No second listener component is created.
- Cache invalidation: `project:{id}:members`, `projects:shared:{userId}`.
- Copy project link with "Copied!" feedback.
- E2E for M1 acceptance run steps 2 and 6.

Out of scope / non-goals:
- Email notifications or invitation tokens (D-021; never in M1).
- "Leave project" by a member, owner transfer, multiple owners (never in M1–M3).
- Public/anonymous links (F20), link-level roles, expiring access.
- Liveblocks auth route and token issuance (F05); hiding canvas mutation affordances for viewers (F06/F08/F09 read `role`/`canWrite`).
- Pagination of the member list (cap is practical: Liveblocks 10 connections/room; UI lists all rows).
- Normalising provider-specific aliases (Gmail dots/`+tags`) — emails are compared after `trim().toLowerCase()` only.

## User stories

- US-1: As an owner, I want to invite a teammate by email as editor or viewer so that they can open my project.
- US-2: As an owner, I want to see who has access, with names and avatars where known, and "Pending" for people who haven't signed in yet.
- US-3: As an owner, I want to change a member's role or remove them, and have it apply immediately even if they are in the room now.
- US-4: As an invitee without an account, I want the project to appear under "Shared with me" right after I sign up with the invited email.
- US-5: As an editor or viewer, I want to see the member list and copy the project link, but I must not be able to invite, re-role, or remove anyone — even by calling the actions directly.
- US-6 (abuse): As a removed user, I must not be able to keep editing from an open tab, rejoin the room, or reopen the project URL.
- US-7 (abuse): As an owner, I must not be able to spam-invite more than 20 addresses per hour.
- US-8 (abuse): As a non-member, calling any sharing action with a guessed project id must yield the same `FORBIDDEN` whether the project exists or not.

## Key decisions referenced

- D-005, D-011 (email-keyed members, lazy binding), D-015 (access tokens derived from Postgres; KICK mandatory), D-021 (no email notification), F03/D-024–D-026 (Server Actions only; seam; cache tags), security-model "Revocation" and "Invitations".
- **PROPOSED D-030 — Every role change broadcasts `ROLE_CHANGED { userId, role }` (promotions included), and every removal broadcasts `KICK { userId }`** (domain-model.md `RoomEvent`; security-model.md "Revocation"). Rationale: a viewer promoted to editor holds a `*:read` token until it is refreshed; the same reload path gives them `*:write` immediately. One client mechanism, one test per event.
- **PROPOSED D-031 — The client's response to `KICK` and to a self-addressed `ROLE_CHANGED` is `client.logout()` + full reload of the current URL** (implemented by F05's `kick-listener.tsx`). The reload re-runs F04's gate, so removal lands on AccessDenied and a role change lands on the workspace with the new role and a freshly issued token. Rationale: deterministic, clears any client-side token cache, keeps F04's gate the single authorization point. Cost: a visible reload for the affected user (shown with an overlay explaining why).
- **PROPOSED D-032 — Reconnect re-verification.** On every `reconnecting → connected` transition the client calls `checkMyAccess({ projectId })`; a changed or null role triggers the same path as `KICK`. Closes the offline-during-KICK gap without server-side token invalidation (which Liveblocks does not offer for access tokens — UNVERIFIED beyond "not disconnected").
- **PROPOSED D-033 — Member removal is allowed on archived projects; invite and role change are not.** Reducing access is always safe; granting it on a read-only project is not meaningful.

## Reference material

- `context/security-model.md` (Authorization, Collaboration room access/Revocation, Invitations, Rate limiting), `context/domain-model.md` (ProjectMember, Role, RoomEvent, invariants 2–4), `context/data-ownership.md` (rows 3, 4; rule 4), `context/ui-context.md` (dialogs, icons, copy), `context/product-requirements.md` (PRD-010–014), `context/project-overview.md` (M1 acceptance run steps 2, 6).
- Research (checked 2026-10-22): `scratchpad/research/liveblocks.md` §5 (access tokens; room-level accesses ignored; "users are not automatically disconnected" when access is removed; token TTL **not published → UNVERIFIED**; `broadcastEvent` + `useEventListener` kick pattern; `client.logout()` purges cached tokens; `{ error: 'forbidden' }` from the auth endpoint stops retries), §8 (`useStatus` values, reconnect uses a new WebSocket; no documented re-auth on reconnect → UNVERIFIED, hence D-032), §9 (`broadcastEvent` in the Node SDK; `getActiveUsers`); `scratchpad/research/nextjs-testing.md` §6 (`updateTag` same-response re-render), §1 (no PII in cache tags → tags carry ids only); `scratchpad/research/services.md` §A3 (Clerk webhooks eventually consistent, may reorder — binding must work from both the webhook and the lazy upsert).
- Reference prompt (intent only): `No_touch_ai/.../09-share-dialog.md` — we diverge: names/avatars come from the local `User` table (D-011), not the Clerk Backend API; roles exist (reference had none); "collaborator" → "member".
