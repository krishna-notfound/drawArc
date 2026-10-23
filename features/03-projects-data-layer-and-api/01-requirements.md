# F03 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The repo shall configure Prisma 7 as follows: `prisma.config.ts` at the root importing `dotenv/config` and setting `datasource.url = env('DATABASE_URL_UNPOOLED')`; `prisma/schema.prisma` uses `generator client { provider = "prisma-client"; output = "../lib/generated/prisma" }`; packages `prisma`, `@prisma/client`, `@prisma/adapter-neon` pinned `~7.10`; `lib/generated/` git-ignored. | must | D-010, NFR-010 | AC-001 |
| FR-002 | `lib/prisma.ts` shall export one `PrismaClient` constructed with `new PrismaNeon({ connectionString: env.DATABASE_URL })`, cached on `globalThis` outside production, and shall be the only module that constructs a client. | must | code-standards "Data access" | AC-002 |
| FR-003 | The schema shall define `Project`, `ProjectMember`, `ProjectStatus { ACTIVE, ARCHIVED }`, `MemberRole { EDITOR, VIEWER }` with the fields, defaults, indexes, unique constraint, and cascade exactly as `domain-model.md`, plus relation fields on `User`; delivered as the second migration. | must | PRD-003, D-005, D-011 | AC-003, AC-004 |
| FR-004 | `getProjectRole(user, projectId)` shall return `'owner'` when `project.ownerId === user.id`; else the member row matched by `userId`, else by `email` (lowercase) where `userId IS NULL`; else `null`. It shall return `null` for a malformed id (no DB query), a missing project, or a project whose owner has `deletedAt` set. | must | domain-model "Role", security-model rule 3–4 | AC-005, AC-006, AC-007 |
| FR-005 | When the match is by email only, `getProjectRole` shall bind `userId` and set `acceptedAt` in the same call, idempotently (`updateMany` guarded by `userId: null`). | must | PRD-011, D-011 | AC-008 |
| FR-006 | `requireProjectRole(projectId, atLeast)` shall call `requireUser()`, resolve the role, and return `{ user, project, role }`; it shall throw `AccessError('FORBIDDEN')` when the role is `null` or ranks below `atLeast` (`viewer < editor < owner`). | must | security-model rules 1–2 | AC-009, AC-010 |
| FR-007 | Archived rule: when `project.status === 'ARCHIVED'`, `requireProjectRole` shall throw `AccessError('FORBIDDEN', 'PROJECT_ARCHIVED')` if `atLeast === 'editor'`; `'viewer'` and `'owner'` requests succeed (members read; owner may unarchive/delete). | must | security-model rule 5, O-4 | AC-011 |
| FR-008 | `createProject(input)` shall validate with `CreateProjectInput`, insert a project owned by the caller (`name` defaulting to `Untitled Project` when empty), call `externals.ensureRoom(id)` best-effort, `updateTag('projects:owned:{userId}')`, and return `{ ok: true, data: { id } }`. | must | PRD-003, US-1 | AC-012, AC-013, AC-014 |
| FR-009 | `renameProject(input)` shall require role `owner`, reject archived projects with `CONFLICT`/`PROJECT_ARCHIVED`, update `name` (and optional `description`), and `updateTag('project:{id}')`. | must | PRD-003, US-2 | AC-015, AC-016 |
| FR-010 | `archiveProject` / `unarchiveProject` shall require role `owner`, be idempotent (already in target state → `ok: true`), and `updateTag('project:{id}')` plus `updateTag('projects:owned:{userId}')`. | must | O-4 | AC-017 |
| FR-011 | `deleteProject` shall require role `owner`, collect bound member user ids, delete the row (cascade removes members), then best-effort: `externals.kickUsers(id, [ownerId, ...memberUserIds])`, `externals.deleteSnapshot(id)`, `externals.deleteRoom(id)`; failures are logged with `projectId` and never fail the action. It shall `updateTag('project:{id}')` and `updateTag('projects:owned:{userId}')`. | must | PRD-003, invariant 7, data-ownership rule 7 | AC-018, AC-019, AC-020 |
| FR-012 | `listMyProjects(userId)` and `listSharedProjects(userId)` shall be `'use cache'` functions taking only `userId`, with `cacheLife('minutes')` and tags `projects:owned:{userId}` / `projects:shared:{userId}` plus `project:{id}` for each returned row; they shall exclude `ARCHIVED` projects and projects whose owner is deleted; the shared list shall match `ProjectMember.userId = userId` only (never email). | must | PRD-004, D-026, Next auth guide | AC-021, AC-022, AC-023 |
| FR-013 | Every Server Action shall return `ActionResult<T>` and never throw for expected failures; `toActionError` maps `AccessError` → its code, `ZodError` → `VALIDATION` with `fieldErrors`, Prisma `P2002` → `CONFLICT`, `P2025` → `NOT_FOUND`, anything else → `UPSTREAM` (logged with `userId`, `projectId`). | must | code-standards rule 5, 8; architecture "Error handling" | AC-024, AC-025 |
| FR-014 | A non-member calling any owner-only action with a missing or foreign `projectId` shall receive the identical `FORBIDDEN` result (no existence leak). | must | security-model rule 3 | AC-026 |
| FR-015 | No `app/api/projects/**` route handler shall exist in M1; a static check enforces it. | should | D-024 | AC-027 |
| FR-016 | All project queries shall be scoped by `ownerId = userId` or `members.userId = userId`; no unscoped `findMany` on `Project`/`ProjectMember`. | must | security-model rule 4, NFR-001 | AC-028 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Every action starts with `requireUser()` and names a minimum role via `requireProjectRole`; `projectId` is only ever an argument to it. AUTHZ-MATRIX in 05-test-plan.md. |
| NFR-002 | All action inputs parsed with Zod (`schemas/project.ts`); ids validated as cuid before any query. |
| NFR-007 | Generated client typed; `AccessError`, `ActionResult` are discriminated unions; no `any`. |
| NFR-009 | External-system failures logged via `lib/logger.ts` with `projectId`, `userId`, `op`. |
| NFR-010 | `~7.10` pins for the three Prisma packages; `prisma validate` in `npm run check`. |

## UX and interaction behaviour

F03 has no UI. Behaviour visible to F04/F12 consumers:

| Surface | Behaviour |
|---|---|
| `createProject` success | returns `{ id }`; caller navigates to `/editor/{id}`; the owned list already contains the project on the next render (updateTag). |
| Expected failures | `{ ok: false, error: { code, message, fieldErrors? } }` with user-safe `message` strings (table in 02-design.md) that the UI may display verbatim. |
| Archived project | readable by members; `renameProject` → `CONFLICT` "This project is archived. Unarchive it to make changes."; `unarchiveProject`/`deleteProject` allowed for owner. |
| Default name | empty/whitespace `name` → `Untitled Project`. |

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | `projectId` is not a valid cuid (`'../x'`, empty, 1 000 chars) | `getProjectRole` → `null` without a DB query; actions → `VALIDATION` | AC-006, AC-025 |
| EC-002 | Project row does not exist | `getProjectRole` → `null`; `requireProjectRole` → `FORBIDDEN` (same as non-member) | AC-007, AC-026 |
| EC-003 | Editor/viewer calls `renameProject`/`deleteProject` | `FORBIDDEN` "You don't have permission to do that." | AC-010 |
| EC-004 | Owner calls `renameProject` on an `ARCHIVED` project | `CONFLICT` `PROJECT_ARCHIVED` | AC-016 |
| EC-005 | Member row matched by email, two concurrent first requests | both resolve the role; only one `updateMany` changes a row (`userId: null` guard); no error | AC-008 |
| EC-006 | Member row for my email is already bound to a *different* `userId` (email re-assigned in Clerk) | no access (`null`); re-binding is F02's webhook job, not F03's | AC-005 |
| EC-007 | Invite email stored in mixed case or caller email has different case | comparison uses `user.email.toLowerCase()`; stored emails are lowercased by F12 at write time | AC-005 |
| EC-008 | `ensureRoom` throws at create (Liveblocks down) | project is still created; warning logged; rooms auto-create on first connection (liveblocks.md §9) | AC-014 |
| EC-009 | `deleteRoom` / `deleteSnapshot` throws at delete | action returns `ok: true`; error logged with `projectId` for manual cleanup; no retry queue in M1 | AC-019 |
| EC-010 | Owner deletes while members are connected to the room | `kickUsers` broadcasts `KICK` to each bound member before `deleteRoom`; F12's client handler reloads and lands on AccessDenied. Whether `deleteRoom` itself disconnects clients is UNVERIFIED — the KICK is the guarantee | AC-020 |
| EC-011 | Double submit of `createProject` (two clicks) | two projects are created (actions are not idempotent); F04 disables the button while pending (F04/EC) | — (F04) |
| EC-012 | `renameProject` and `deleteProject` race on the same id | whichever reaches Postgres second: rename after delete → `NOT_FOUND` (P2025 mapped); delete after rename → ok | AC-025 |
| EC-013 | Owner's `User.deletedAt` is set (Clerk user deleted) | project hidden from members' lists and `getProjectRole` → `null` for members; owner cannot call (no session) | AC-007, AC-023 |
| EC-014 | `name` is 101 chars, or `description` 501 chars, or whitespace-only `name` on rename | `VALIDATION` with `fieldErrors.name` / `fieldErrors.description`; whitespace-only on *create* → `Untitled Project` | AC-012, AC-024 |
| EC-015 | Unauthenticated call to any action (`requireUser` throws) | `UNAUTHENTICATED` result; no DB write | AC-029 |
| EC-016 | Neon unreachable / Prisma throws a connection error | `UPSTREAM` "Something went wrong. Please try again."; error logged | AC-025 |
| EC-017 | `listSharedProjects` for a user whose pending membership has not been bound yet (no `requireUser` call happened since invite) | not listed until the next `requireUser` (F02 binding) or `getProjectRole` call binds it; F12 handles bound-at-invite case by `updateTag` | AC-022 |
| EC-018 | Same `cacheTag` space across users | tags include `userId`; a mutation by A never invalidates B's list except through `project:{id}` which is intentional | AC-021 |
