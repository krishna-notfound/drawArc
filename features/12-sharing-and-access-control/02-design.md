# F12 — Design

## Architecture and components

```
app/editor/[projectId]/page.tsx (F04 gate, modified) ──► listProjectMembers(project.id) ──► shareSlot={<ShareButton …/>}
components/editor/share-button.tsx ─► share-dialog.tsx ─► member-row.tsx ─► hooks/useShareDialog.ts ─► app/editor/[projectId]/actions.ts
components/editor/kick-listener.tsx (F05, modified) ─► hooks/useKickListener.ts (extracted here) ─► checkMyAccess action; @liveblocks/react useEventListener/useStatus/useClient; F05 useUnloadGuard
app/editor/[projectId]/actions.ts ─► lib/projects/member-service.ts ─► lib/prisma.ts, lib/access.ts, lib/liveblocks.ts (F05), lib/logger.ts
```

| File | New/Modified | Server/client | Responsibility |
|---|---|---|---|
| `schemas/member.ts` | new | shared | Zod inputs |
| `lib/projects/members.ts` | new | server | `listProjectMembers` (`'use cache'`), `countRecentInvites` |
| `lib/projects/member-service.ts` | new | server | `inviteMemberCore`, `changeMemberRoleCore`, `removeMemberCore`, `broadcastKick` |
| `app/editor/[projectId]/actions.ts` | new | server | four `'use server'` actions (F03 skeleton) |
| `app/editor/[projectId]/page.tsx` | modified (F04) | server | loads members after the gate; passes `shareSlot` |
| `components/editor/share-button.tsx` | new | client | navbar button + dialog open state |
| `components/editor/share-dialog.tsx` | new | client | dialog, invite form, list, copy link |
| `components/editor/member-row.tsx` | new | client | row with role select / remove confirm |
| `hooks/useShareDialog.ts` | new | client | pending/error state per action, `startTransition` (same pattern as F04/D-027) |
| `hooks/useKickListener.ts` | new (extracted from F05's component) | client | KICK + ROLE_CHANGED for self → overlay → `suppress()` → `client.logout()` → reload; registers `checkMyAccess` on F05's `onReconnected` hook point |
| `components/editor/kick-listener.tsx` | modified (F05) | client | becomes a thin host of `useKickListener`; already mounted inside `ProjectRoom` by F05 — nothing new is mounted |
| `components/ui/select.tsx` | generated | client | shadcn `Select` (added by CLI; not edited) |

## Domain model and TypeScript contracts

```ts
// schemas/member.ts
export const EmailSchema = z.string().trim().toLowerCase().min(3).max(254).email('Enter a valid email address');
export const MemberRoleSchema = z.enum(['editor', 'viewer']);            // UI/API vocabulary; mapped to Prisma EDITOR/VIEWER in the service
export const MemberIdSchema = z.string().cuid();
export const InviteMemberInput = z.object({ projectId: ProjectIdSchema, email: EmailSchema, role: MemberRoleSchema });
export const ChangeMemberRoleInput = z.object({ projectId: ProjectIdSchema, memberId: MemberIdSchema, role: MemberRoleSchema });
export const RemoveMemberInput = z.object({ projectId: ProjectIdSchema, memberId: MemberIdSchema });
export const CheckMyAccessInput = z.object({ projectId: ProjectIdSchema });

// lib/projects/members.ts
export interface MemberListItem { id: string; email: string; role: 'editor' | 'viewer'; status: 'active' | 'pending'; name: string | null; avatarUrl: string | null; invitedAt: string }
export interface ProjectMembers { owner: { id: string; name: string | null; email: string; avatarUrl: string | null }; members: MemberListItem[] }
export async function listProjectMembers(projectId: string): Promise<ProjectMembers>;   // 'use cache'; cacheLife('minutes'); cacheTag(`project:${projectId}:members`)
export async function countRecentInvites(inviterId: string, since: Date): Promise<number>;

// lib/projects/member-service.ts
export async function broadcastKick(projectId: string, userId: string): Promise<boolean>;                       // → F05 kickUser; true = delivered
export async function broadcastRoleChanged(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<boolean>;  // → F05 notifyRoleChanged

// hooks/useKickListener.ts
export function useKickListener(args: { projectId: string; currentUserId: string; role: ProjectRole }): { kicked: boolean };
```

Domain-model `RoomEvent` members used as declared: `{ type: 'KICK'; userId }` (removal) and `{ type: 'ROLE_CHANGED'; userId; role }` (role change). No new event types.

## Data and state ownership

| State | Owner | This feature |
|---|---|---|
| Membership rows and roles | Postgres | sole writer (owner-only actions) |
| Member display name/avatar | Postgres `User` (projection of Clerk) | read-only; may lag Clerk (data-ownership rule 5) |
| Live room permission | Liveblocks access token (derived) | forces re-derivation by KICK + reload; never calls `updateRoom` with `usersAccesses` (invariant 4) |
| Member list cache | Next data cache (derived) | tag `project:{id}:members`; invalidated by the three mutations |
| Invitee's shared list cache | Next data cache (derived) | tag `projects:shared:{userId}` (F03) updated on invite/remove when bound |
| Dialog UI state (pending rows, confirm state, copied flag) | client memory | reset on close |

## API and integration contracts

| Action (`app/editor/[projectId]/actions.ts`) | Input | Min role | Success data | Error codes (reason) | Tags updated | Room event |
|---|---|---|---|---|---|---|
| `inviteMember` | `InviteMemberInput` | owner | `MemberListItem` | `UNAUTHENTICATED`, `VALIDATION`, `FORBIDDEN`, `CONFLICT (PROJECT_ARCHIVED \| SELF_INVITE \| DUPLICATE_MEMBER)`, `RATE_LIMITED`, `UPSTREAM` | `project:{id}:members`; `projects:shared:{userId}` if bound | none |
| `changeMemberRole` | `ChangeMemberRoleInput` | owner | `{ member: MemberListItem; kickDelivered: boolean }` | `UNAUTHENTICATED`, `VALIDATION`, `FORBIDDEN`, `CONFLICT (PROJECT_ARCHIVED)`, `NOT_FOUND`, `UPSTREAM` | members; shared if bound | `ROLE_CHANGED { userId, role }` to `member.userId` if bound and role changed |
| `removeMember` | `RemoveMemberInput` | owner | `{ memberId; kickDelivered: boolean }` | `UNAUTHENTICATED`, `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `UPSTREAM` | members; shared if bound | `KICK` if bound |
| `checkMyAccess` | `CheckMyAccessInput` | viewer | `{ role: ProjectRole }` | `UNAUTHENTICATED`, `VALIDATION`, `FORBIDDEN` | none | none |

Service order of operations (binding):

```ts
// inviteMemberCore({ user, project }, input)
if (project.status === 'ARCHIVED') throw conflict('PROJECT_ARCHIVED');
if (input.email === user.email.toLowerCase()) throw conflict('SELF_INVITE');
if (await prisma.projectMember.findUnique({ where: { projectId_email: { projectId, email } } })) throw conflict('DUPLICATE_MEMBER');
if ((await countRecentInvites(user.id, new Date(Date.now() - 3_600_000))) >= 20) throw rateLimited();
const bound = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
const row = await prisma.projectMember.create({ data: { projectId, email, role: toPrismaRole(input.role), invitedById: user.id, userId: bound?.id ?? null, acceptedAt: bound ? new Date() : null } }); // P2002 → DUPLICATE_MEMBER
// action layer: updateTag(`project:${projectId}:members`); if (bound) updateTag(`projects:shared:${bound.id}`);

// changeMemberRoleCore → load { where: { id: memberId, projectId } } (scoped) → NOT_FOUND; unchanged → return; update; then kickDelivered = member.userId ? await broadcastRoleChanged(projectId, member.userId, role) : true
// removeMemberCore → load scoped → delete → kickDelivered = member.userId ? await broadcastKick(projectId, member.userId) : true
// broadcastKick / broadcastRoleChanged: thin wrappers over F05 kickUser(projectId, userId) / notifyRoleChanged(projectId, userId, role), which retry once and log { projectId, userId, op } on final failure
```

Client contract (`useKickListener`, hosted by F05's `kick-listener.tsx`):

```ts
const client = useClient(); const status = useStatus(); const unload = useUnloadGuard();   // F05 context: { suppress(): void }
useEventListener(({ event }) => {
  if ((event.type === 'KICK' || event.type === 'ROLE_CHANGED') && event.userId === currentUserId) eject();
});
useOnReconnected(() => checkMyAccess({ projectId }).then(r => { if (!r.ok || r.data.role !== role) eject(); }));   // F05 hook point: fires on reconnecting → connected
function eject() { setKicked(true); unload.suppress(); client.logout(); setTimeout(() => window.location.reload(), 250); }
```

Exact client behaviour per case after reload (FR-015): **removed** → F04 gate `FORBIDDEN` → AccessDenied → "Back to projects"; **editor → viewer** → gate ok with `role 'viewer'` → F05 auth route issues `['*:read']` → F06 renders read-only; **viewer → editor** → `['*:write']`; **project deleted** (F03 KICK) → AccessDenied.

Server page change (F04 file): after `requireProjectRole`, `const members = await listProjectMembers(project.id)`; `shareSlot={<ShareButton projectId={project.id} projectStatus={project.status} role={role} members={members} />}`. Because the action calls `updateTag`, the page re-renders in the same response and the open dialog receives fresh `members` props (server-actions.md L34–74).

## Security and validation

- **Token TTL is UNVERIFIED** (liveblocks.md §5): the broadcast (KICK on removal, ROLE_CHANGED on role change) is therefore mandatory and is executed in the same action as the DB write, after the write; no path updates a role without broadcasting. Re-verification on reconnect (D-032) covers missed events. `client.logout()` clears cached tokens before reload so the next connection must re-authenticate through F05's route, which re-derives permissions from Postgres.
- **No existence leak**: `requireProjectRole` yields the same `FORBIDDEN` for foreign and missing ids; `checkMyAccess` likewise. Member ids are looked up scoped by `projectId`, so a member id from another project is `NOT_FOUND` only *after* the owner check on the caller's own project.
- **Accepted information disclosure (owner-only)**: the list shows whether an invited email already has a drawArc account ("Pending" vs name). Rationale: only the inviting owner sees it and they supplied the email. Non-owners see names for bound members and the raw email only for pending ones (unavoidable: there is nothing else to show).
- **Archived projects**: invite/role change rejected (`PROJECT_ARCHIVED`); removal allowed (D-033); F05 issues `*:read` to everyone on archived projects (F05 responsibility, derived from `project.status` returned by `requireProjectRole`).
- **Rate limit**: 20 invitations per inviter per rolling hour via `countRecentInvites` (`ProjectMember.invitedById`, `invitedAt >= now-1h`) — counts rows that still exist; limitation recorded in EC-004. No Redis.
- **Validation**: all inputs through `schemas/member.ts`; email normalised by the schema (`trim().toLowerCase()`), max 254; nothing from the email is used to build paths or ids.
- **Privilege boundaries**: owner is never a `ProjectMember`, so no action can demote/remove the owner; `MemberRoleSchema` excludes `'owner'`.
- **Cross-feature requirements** (all now stated in the owning specs, Gate 4): F02 binds pending members by email in *both* the lazy upsert and the `user.created` webhook (F02 FR-010/FR-012); F05 provides `useUnloadGuard().suppress()` (F05 FR-012), mounts `kick-listener.tsx` inside `ProjectRoom` with the `onReconnected` hook point (F05 FR-013/FR-014), exposes `data-role`/`data-can-write`/`data-connection-status` on the room root (F05 02-design), and its auth route returns `{ error: 'forbidden' }` (403) for non-members so a removed client stops retrying (F05 FR-006).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Access tokens: permissions decided by our server per token; room-level `usersAccesses` ignored | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| "When a user's access is removed, they are not automatically disconnected"; recommended `broadcastEvent` KICK + `useEventListener` + reload | https://liveblocks.io/docs/use-cases/share-dialog | 2026-10-22 |
| `client.logout()` purges cached tokens; auth endpoint returning `{ error: 'forbidden' }` stops retries | https://liveblocks.io/docs/api-reference/liveblocks-client | 2026-10-22 |
| `useStatus()` values `initial \| connecting \| connected \| reconnecting \| disconnected`; `useEventListener`; `useClient` | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| `broadcastEvent(roomId, event)` in `@liveblocks/node` | https://liveblocks.io/docs/api-reference/liveblocks-node | 2026-10-22 |
| `updateTag` in a Server Action re-renders the route in the same response | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` L34–74 | 2026-10-22 |
| Clerk webhooks may be delayed, reordered, or repeated → binding must be idempotent and dual-path | https://clerk.com/docs/webhooks/sync-data | 2026-10-22 |
| **UNVERIFIED**: access-token lifetime; whether reconnect re-calls the auth endpoint; whether `preventUnsavedChanges` can be bypassed programmatically. Fallbacks: mandatory KICK (FR-012), reconnect re-verification (FR-016), F05-owned unload guard with `suppress()`. | — | — |
