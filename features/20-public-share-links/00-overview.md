# F20 — Public Share Links

| Field | Value |
|---|---|
| Milestone | Future |
| Depends on | F12 (sharing-and-access-control: owner-only membership actions, KICK), F05 (Liveblocks auth route), F03 (`getProjectRole`), F13 (canvas read route), F18 (specs read routes — must be re-audited) |
| Depended on by | — |
| Product requirements | PRD-014 (explicitly reserves public links for this feature); supersedes part of D-007 on approval |
| Status | see status.md |

## Purpose

Let a project owner hand out a URL that opens the live canvas read-only to anyone who holds it, without sign-in or membership. It exists after F12 because it is the second access path into a project: everything F12 enforces (roles computed in one place, server-side checks on every read and every room join, immediate revocation) must gain a parallel branch for an anonymous, link-authenticated viewer — and that branch must be designed as a deliberate extension of `getProjectRole`, not a bypass of it.

## Problem statement and goals

- Problem: today every view of a diagram requires a Clerk account and an owner invitation (PRD-014). Sharing a design with a reviewer, a client, or a community means inviting each person by email, which is heavy for one-off read access.
- G-1: an owner can create a share link; a visitor with the link sees the live canvas, presence, and cursors as a read-only guest within 3 s of opening it.
- G-2: a link can be revoked or can expire; after either, the URL returns the access-denied view and any connected guest is ejected within 5 s (same bar as PRD-013).
- G-3: no guest can mutate anything: the Liveblocks token is `['*:read']`, every mutation route and action rejects the guest branch, and the UI hides all affordances (PRD-012 behaviour applied to guests).
- G-4: the raw token is shown exactly once and never stored; only its hash is persisted.

## Scope

In scope:
- `ShareLink` entity exactly as reserved in domain-model.md: `{ id, projectId, token (hashed), role: 'viewer', expiresAt?, revokedAt?, createdById }` plus `createdAt`; index `(projectId, revokedAt)`; unique on the hash. Migration requires separate authorization.
- Token: 32 random bytes, base64url (43 chars), shown once in the share dialog; stored as SHA-256 hex. Lookup is by hash, constant-time compare not needed (hash is the key), but the route never reveals whether a link exists vs is revoked (identical access-denied).
- Owner-only Server Actions: `createShareLink(projectId, { expiresAt? })`, `revokeShareLink(linkId)`, `listShareLinks(projectId)`. ≤ 5 active (non-revoked, non-expired) links per project — 409 above.
- Page `app/share/[token]/page.tsx`: public route (added to the proxy public list); Suspense child hashes the token, loads the link + project, renders the workspace in guest mode with `role: 'viewer'` and a "Viewing as guest" pill; otherwise the F04 access-denied view.
- Second path in `app/api/liveblocks-auth/route.ts`: if the request carries a share token (sent via the `authEndpoint` callback form as a body field, never a query string), verify hash + not revoked + not expired → `prepareSession('anon:<linkId>:<nonce>', { userInfo: { name: 'Guest', avatar: null, color } })` → `session.allow(projectId, ['*:read'])`. The signed-in path is unchanged and checked first.
- Second branch in `getProjectRole`: a new overload/`principal` type `{ kind: 'shareLink', linkId }` resolving to `'viewer'` or `null`. Every read route that guests need (`GET /api/projects/[projectId]/canvas` for seeding an empty room) accepts the share-token principal; `GET …/specs` and `…/specs/[specId]/download` **do not** (PROPOSED: specs are member-only — they may contain chat context and are a separate deliverable; the owner can decide otherwise).
- Revocation: `revokeShareLink` sets `revokedAt` then `broadcastEvent(projectId, { type: 'KICK', userId: 'anon:<linkId>:*' })`; the client-side KICK handler (F12) is extended to match on the `anon:<linkId>:` prefix of `useSelf().id`. Expiry is enforced at auth time and by a client timer that reconnects at `expiresAt` (which then fails auth).
- Rate limits: ≤ 60 token verifications per IP per minute on the share page and auth route (DB-backed counter or Vercel firewall rule); ≤ 5 active links per project; link creation owner-only.
- Guests count toward the room's connection cap; the UI surfaces Liveblocks' room-full error (4005) with copy aimed at guests.

Out of scope / non-goals:
- Editable (write) share links — never, without a new decision; the entity's `role` is fixed to `'viewer'`.
- Password-protected links, link analytics, per-link names — not in the first version.
- Public project directory / discovery — never.
- Commenting by guests — Comments are not used in M1–M3.

## User stories

- US-1: As an owner, I want to create a read-only link so that a reviewer without an account can look at the live design.
- US-2: As an owner, I want to set an expiry and revoke a link so that access does not outlive its purpose.
- US-3: As a guest, I want to see live cursors and changes so that I can follow a walkthrough in real time.
- US-4: As a member, I want to see that guests are present (as "Guest" in the avatar stack) so that I know who is watching.
- US-5 (abuse): As a holder of a revoked or expired link I must not be able to open the room: the page shows access-denied, the auth route returns `{ error: 'forbidden' }` 403, and an already-connected guest is ejected within 5 s.
- US-6 (abuse): As a guest I must not be able to write: the Liveblocks token is read-only, the snapshot `PUT`, AI routes, and all Server Actions return 403 for the share-link principal, and no mutation affordance renders.
- US-7 (abuse): As an attacker I must not be able to enumerate links: hashes are random 256-bit values, failures are rate-limited, and existence is never leaked.

## Key design idea

**One role resolver, two principals.** `getProjectRole` today takes a user; this feature gives it a discriminated `Principal` (`{ kind: 'user', id, email } | { kind: 'shareLink', linkId }`). Every read route and the Liveblocks auth route resolve the principal first, then call the same function. Mutations never accept a share-link principal (they call `requireUser()` first, which has no guest branch). This keeps invariant 3 of domain-model.md ("role computed by `getProjectRole` only") true and turns D-007's "single extension point" into the actual extension.

Anonymous identity for Liveblocks: `userId = 'anon:<linkId>:<nonce>'` so that (a) ids are unique per connection, (b) revocation can target one link's guests by prefix, and (c) `userInfo.name` is "Guest". Liveblocks' fair-use rule requires unique `userId`s — the nonce satisfies it.

Plan impact (https://liveblocks.io/pricing checked 2026-10-22, liveblocks.md §11): anonymous connections count against the **Free plan cap of 3,000 anonymous connections per month**, and every guest consumes one of the **10 simultaneous connections per room** on Free and Pro. A widely shared link can lock members out of their own room; the spec must either reserve connections for members (reject guests above 7) or document the limit. Also O-2 (Free is non-commercial) applies before any public deployment.

## Security changes this feature requires (must be listed in 02-design.md when specified)

1. `app/api/liveblocks-auth/route.ts` becomes two-path; D-007's "one path, no anonymous tokens" is superseded by a new decision.
2. `getProjectRole` gains the share-link principal; the role matrix test (security-model.md "Security test obligations") gains rows: valid link, expired link, revoked link, link for another project, link + archived project.
3. **Every read endpoint from F03, F13, F18 must have its AUTHZ-MATRIX re-run** with the new principal, including the ones that must *reject* it (specs). Mutation endpoints must prove they still reject it (they do by construction via `requireUser`, but the test must exist).
4. `proxy.ts` public-route list gains `/share/*`; `app/share/[token]` must not render any member-only data (member list, project description beyond the name).
5. PRD-014 wording ("anyone without membership gets access-denied") is amended to "…or a valid share link".
6. KICK handler matches on prefix; the `RoomEvent` type's `userId` field gets a documented wildcard form, or a new event `{ type: 'KICK_LINK', linkId }` is added (PROPOSED: new event, keeps the existing KICK exact-match).

## Key decisions referenced

- D-007 (APPROVED: no public links in M1–M3; `ShareLink` reserved; `getProjectRole` is the extension point) — this feature is the planned supersession.
- D-015 (access tokens with permissions from Postgres) — guests also receive access tokens, derived from the link row.
- R-02, R-03 (connection cap; revocation needs KICK).
- PROPOSED D-20a — "Share links are viewer-only, hashed, max 5 active per project, owner-created." Rationale: smallest surface that satisfies the use case; write links would require guest identity and undo semantics.
- PROPOSED D-20b — "Specs are not visible via share links." Rationale: specs may embed chat context; keep the guest surface to the canvas.
- PROPOSED D-20c — "Guests are capped at 7 per room so 3 connections stay reserved for members." Rationale: 10-connection room limit on Free/Pro.

## Preconditions before this feature is specified

1. F12 is `verified` (KICK ejection ≤ 5 s proven E2E) and F05's auth route has its AUTHZ tests, so the second path can be added as a diff with a regression baseline.
2. The owner approves a decision superseding D-007 and amending PRD-014; `ShareLink` migration is separately authorized.
3. O-2 resolved: a paid Liveblocks plan is in place before any public URL exists (Free is non-commercial; anonymous-connection cap).
4. Decision on D-20b (specs visibility) and D-20c (guest cap) recorded.
5. Rate-limit mechanism chosen (DB counter per IP vs Vercel firewall rule) consistent with security-model.md's "no Redis/KV".

## Reference material

- `context/security-model.md` — authorization rules, Liveblocks room access, revocation, rate limiting, deletion.
- `context/domain-model.md` — `ShareLink` reservation, role resolution, invariants 3–4.
- `context/decision-log.md` D-007, D-015; `context/progress-tracker.md` R-02, R-03.
- Research liveblocks.md §5 (access tokens, `prepareSession`, forbidden response) — https://liveblocks.io/docs/api-reference/authentication/access-token checked 2026-10-22; §11 (pricing: 10 connections/room, 3,000 anonymous connections/month on Free) — https://liveblocks.io/pricing checked 2026-10-22; fair-use unique `userId` rule — https://liveblocks.io/docs/pricing/limits/fair-use-guidelines checked 2026-10-22; share-dialog revocation pattern — https://liveblocks.io/docs/use-cases/share-dialog checked 2026-10-22.
- Reference prompts (`No_touch_ai/`): `09-share-dialog.md` (member sharing only; no public links). None cover anonymous access.
