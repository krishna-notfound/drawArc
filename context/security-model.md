# drawArc — Security Model

> Tenancy and sharing decisions APPROVED (D-005, D-007, D-011). Enforcement design PROPOSED; becomes binding when features `02`, `03`, `05`, `12` are approved. Facts about Clerk/Liveblocks/Blob are VERIFIED 2026-10-22.

## Trust boundaries

```
Untrusted: browser, Liveblocks client, webhook senders (until verified), LLM output (M2), snapshot JSON (even from our own client)
Trusted after verification: Clerk session (proxy + auth()), verified webhooks, Trigger.dev task payloads we enqueued
Fully trusted: our server code, env secrets, Postgres
```

Everything that crosses from untrusted to trusted is **authenticated, authorized, then validated with Zod**, in that order.

## Authentication (Clerk)

- `proxy.ts` exports `clerkMiddleware()` with the standard matcher. It establishes the session; it does **not** decide access (Clerk's current guidance; `createRouteMatcher` is deprecated).
- Public routes: `/`, `/sign-in/*`, `/sign-up/*`, `/api/webhooks/*`. Everything else requires a session, enforced **where data is read**: pages call `requireUser()` inside a Suspense child; route handlers and Server Actions call it first.
- `requireUser({ unauthenticated: 'redirect' | 'throw', returnTo? })` = `await auth()` → if no `userId`: pages pass `'redirect'` (to sign-in with `returnTo`), handlers/actions pass `'throw'` (`AccessError('UNAUTHENTICATED')` → 401) → lazy-upsert `User` from `currentUser()` if the row is missing → bind pending `ProjectMember` rows whose `email` matches (PRD-011; also done in the `user.created` webhook) → return `{ user }`. `AccessError`, `ActionResult`, and the error-code union live in `lib/errors.ts` (F00).
- Clerk webhooks (`user.created|updated|deleted`) are verified with `verifyWebhook(req)` (`CLERK_WEBHOOK_SIGNING_SECRET`); handlers are idempotent (upsert by `clerkId`), tolerate reordering, and return 200 after processing, 400 on signature failure.
- Clerk's full `User` object (contains `privateMetadata`) is never passed to the client.

## Authorization (project roles)

Single function, single place: `lib/access.ts`.

```ts
getProjectRole(user: { id; email }, projectId): Promise<'owner' | 'editor' | 'viewer' | null>
requireProjectRole(projectId, atLeast: ProjectRole): Promise<{ user, project, role }>   // throws typed AccessError
```

Rules:
1. `projectId` from the URL, body, or room id is **never** trusted; it is only an argument to `requireProjectRole`.
2. Every mutation names its minimum role explicitly (`'editor'` for canvas saves and AI runs, `'owner'` for membership and project lifecycle).
3. The workspace page performs the gate server-side and renders `AccessDenied` for both "no membership" and "project does not exist" — identical response, no existence leak. Route handlers and actions do the same with **403 and an identical body** for non-member and missing project.
4. Lists are scoped by the caller (`ownerId = me` or `member.userId = me / member.email = my email`); no `findMany` without a scope.
5. Archived projects are readable by members and mutable only by the owner (unarchive/delete).

## Collaboration room access (Liveblocks)

- Route: `POST /api/liveblocks-auth`. Body from the Liveblocks client includes the `room` id. Flow: `requireUser` → `requireProjectRole(room, 'viewer')` → `prepareSession(user.id, { userInfo: { name, avatar, color } })` → `session.allow(room, role === 'viewer' ? ['*:read'] : ['*:write'])` → `authorize()`. No wildcards. On no access return `{ error: 'forbidden', reason }` with 403 so the client stops retrying.
- Room ids are project cuids; the auth route also rejects ids that fail the cuid format before touching the DB.
- This route is never cached (`'use cache'` forbidden; it reads cookies).
- **Revocation.** Liveblocks does not disconnect a connected user when access changes and token lifetime is unpublished (UNVERIFIED). Therefore removing a member broadcasts `{ type: 'KICK', userId }` and any role change broadcasts `{ type: 'ROLE_CHANGED', userId, role }`, in the same Server Action as the Postgres update. The client's `useEventListener` compares to `useSelf().id`, calls `client.logout()` (purges cached tokens) and performs a full reload; the server gate then denies (removal) or the auth route issues a read token (downgrade). A client that was offline during the broadcast re-verifies access on reconnect via a `checkMyAccess` action (F12 D-032). PRD-013 requires all of this within 5 s.
- Server-side writes (M2) use the secret key from Trigger.dev's environment, never from the Next.js client bundle, and only after the task re-verifies `TaskRun` → project → requester role.
- Liveblocks webhooks are verified with `WebhookHandler.verifyRequest` using the raw body (`request.text()`).

## Snapshot and artifact access (Blob)

- The Blob store is **private**. Reads happen only in route handlers after `requireProjectRole`, via `get(pathname, { access: 'private' })`, streamed to the client. Signed URLs are not used in M1.
- Pathnames are deterministic and derived from ids we own (`canvas/{projectId}.json`, `specs/{projectId}/{specId}.md`); user input never forms a pathname.
- Snapshot uploads: body ≤ 4 MB (Vercel function limit is 4.5 MB), parsed and validated as `CanvasDocument` before `put`; node count ≤ 2,000, edge count ≤ 4,000 (NFR-004 headroom) — reject with 422 above.

## Invitations

- Only owners invite; emails are normalised; inviting the owner's own email or an existing member is a 409.
- No invitation token or email is sent in M1: access is granted immediately to the email, and the invitee discovers the project in "Shared with me" after signing in with that email. (Email notification is a future enhancement; recorded in decision log.)
- Rate limit: ≤ 20 invitations per owner per hour (DB count), to deter spam-sharing. 429 above.

## Input validation

- Zod schemas live next to their boundary (`schemas/*.ts` or colocated). Every route handler/action: `const input = Schema.safeParse(body)`; failure → 400 with field errors, never thrown stack traces.
- Canvas documents, templates, and (M2) LLM tool-call outputs validate against the same `CanvasDocumentSchema`.
- Trigger.dev tasks use `schemaTask` so payloads are validated again at the worker.

## Rate limiting and abuse (PROPOSED minimum)

- M1: DB-backed limits on the two abusable writes — invitations (above) and snapshot saves (≤ 6 per project per minute; the client's 30 s debounce stays well under). Vercel's built-in firewall handles volumetric abuse. No Redis/KV.
- M2: AI runs ≤ 10 per user per hour and 1 concurrent per project (Trigger.dev `concurrency: { perKey: 1 }`, key = projectId).

## Secrets and configuration

- `lib/env.ts` validates `process.env` with Zod at module load: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `LIVEBLOCKS_SECRET_KEY`, `LIVEBLOCKS_WEBHOOK_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN` (local/CI only; OIDC on Vercel), `TRIGGER_SECRET_KEY` (M2); client-safe: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` (tests only).
- `.env*` is git-ignored; `.env.example` documents every key without values.
- Trigger.dev tasks get secrets from the Trigger.dev dashboard / `syncVercelEnvVars`, never from the repo.

## Deletion and data lifecycle

- Project delete (owner): Postgres cascade → Blob `del` → `deleteRoom`. Failures of the last two are logged with `projectId` for manual cleanup.
- User delete (Clerk webhook): mark `deletedAt`; owned projects remain (owner-transfer is out of scope) and are hidden; memberships are removed.
- Member removal: row delete + KICK (above).

## Security test obligations (every feature's test plan must include)

- 401 for unauthenticated, 403 for wrong role, 403 with the same body for non-member and for missing project, on **every** new route/action.
- Role matrix test for `getProjectRole` (owner, editor, viewer, email-only pending member, non-member, archived project).
- Liveblocks auth: viewer receives `*:read`, editor `*:write`, non-member 403; KICK ejects within 5 s (E2E).
- Webhook signature failure → 400 and no side effects.

See [testing-strategy.md](testing-strategy.md).
