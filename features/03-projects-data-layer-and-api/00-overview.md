# F03 — Projects data layer and API

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F02 (`requireUser()` in `lib/auth.ts`, Prisma `User` model and first migration) |
| Depended on by | F04 (editor home + workspace gate), F05 (Liveblocks auth uses `requireProjectRole`), F12 (membership mutations), F13 (snapshot pointer fields), F14, F16–F18 (`TaskRun`/`ProjectSpec` extend this schema) |
| Product requirements | PRD-003, NFR-001, NFR-002 (plus NFR-007, NFR-009, NFR-010 exercised) |
| Status | see status.md |

## Purpose

F03 gives drawArc its first tenant-scoped data: the `Project` and `ProjectMember` tables, the single authorization function `getProjectRole` / `requireProjectRole` in `lib/access.ts`, and the Server Actions that create, rename, archive, and delete projects. It sits immediately after authentication because every later feature — the workspace gate (F04), Liveblocks token issuance (F05), sharing (F12), snapshots (F13) — needs a project row and a role lookup before it can do anything. It also pins the Prisma 7 + Neon configuration that all later schema work extends.

## Problem statement and goals

- Problem: without a durable, caller-scoped project model and one authoritative role resolver, each later feature would re-derive "who may touch this project" on its own, which is exactly the class of bug the security model forbids (domain-model invariant 3).
- G-1: a signed-in user can create, rename, archive/unarchive, and delete a project they own through typed Server Actions that never throw for expected failures.
- G-2: `getProjectRole(user, projectId)` returns the correct role for the full matrix (owner, editor, viewer, email-only pending member, non-member, archived, missing project, owner deleted) and binds an email-only member on first call.
- G-3: project lists are cached per user with `'use cache'` + `cacheTag` and are read-your-writes after any mutation via `updateTag`.
- G-4: the feature is fully testable (L1 + L2 against a Neon test branch) before F05 and F13 exist, through injected seams for the Liveblocks room and Blob snapshot side effects.

## Scope

In scope:
- Verification of the Prisma 7 configuration F02 created (`prisma.config.ts` with the unpooled URL and `dotenv/config`, `prisma-client` generator with `output = "../lib/generated/prisma"`, `@prisma/adapter-neon`, `lib/prisma.ts` singleton) against FR-001/FR-002; F03 creates none of these files (F02 owns the Prisma setup and migration 1, D-F02-1).
- `Project`, `ProjectMember`, `ProjectStatus`, `MemberRole` in `prisma/schema.prisma` exactly as in `context/domain-model.md`; back-relations added to `User`; **second migration** (requires its own authorization at Gate 6).
- `lib/access.ts`: `getProjectRole`, `requireProjectRole`, `AccessError` usage, role ranking, email binding, archived rule.
- `lib/errors.ts` addition: `toActionError` only. `ErrorCode`, `AppError`, `AccessError`, `ActionResult<T>`, `ActionError`, `httpStatusFor`, `errorResponse` are owned and defined by F00 (D-036) and consumed here unchanged.
- `schemas/project.ts` Zod schemas.
- `app/editor/actions.ts`: `createProject`, `renameProject`, `archiveProject`, `unarchiveProject`, `deleteProject`.
- `lib/projects/queries.ts`: `listMyProjects(userId)`, `listSharedProjects(userId)` (`'use cache'`).
- `lib/projects/externals.ts`: `ProjectExternals` seam (`ensureRoom`, `deleteRoom`, `deleteSnapshot`, `kickUsers`) with no-op defaults that F05 and F13 replace.
- Test factories `makeUser`, `makeProject`, `makeMember` in `tests/factories.ts`.

Out of scope / non-goals:
- REST route handlers for projects or members — **none in M1** (PROPOSED D-024 below). `api/projects/[projectId]/canvas/route.ts` remains F13's (file body).
- Any UI (F04 owns dialogs and lists; F12 owns the share dialog).
- Membership mutations `inviteMember` / `changeMemberRole` / `removeMember` (F12).
- Liveblocks client, auth route, `lib/liveblocks.ts` (F05); Blob helpers `lib/blob.ts` (F13).
- `TaskRun`, `ProjectSpec` models (F17/F18 migrations).
- Owner transfer, "leave project", project duplication (never in M1–M3).
- Archive UI — the actions exist and are tested; no sidebar affordance until a later feature (see Open issues in status.md).

## User stories

- US-1: As a signed-in user, I want to create a project so that I get a private workspace with its own room.
- US-2: As a project owner, I want to rename, archive, and delete my project so that my list stays accurate and deleted projects leave no room or snapshot behind.
- US-3: As a signed-in user, I want "My Projects" and "Shared with me" to reflect my latest action immediately after it completes.
- US-4: As a user who was invited by email before I had an account, I want my membership to resolve on my first visit so that the project appears under "Shared with me".
- US-5 (abuse): As a non-member I must not be able to rename, archive, or delete a project, nor learn whether a project id exists, by calling any Server Action with a guessed id.
- US-6 (abuse): As an editor I must not be able to perform owner-only lifecycle actions.

## Key decisions referenced

- D-005 (user-owned projects, per-project sharing), D-010 (Prisma 7 pinned `~7.10` with `@prisma/adapter-neon`), D-011 (local `User`, email-keyed members with lazy binding), D-015 (room id = projectId, permissions from Postgres), D-018 (Server Actions for UI mutations), D-023 (pins), D-036 (`lib/errors.ts` owned by F00; F03 adds `toActionError` only), F02/D-F02-1 (F02 owns the Prisma setup and migration 1; F03 owns migration 2), O-4 (keep `ARCHIVED`).
- **PROPOSED D-024 — No REST route handlers for projects or members in M1.** All callers of project/member mutations are our own UI, so Server Actions (D-018) cover them with typed results and single-round-trip `updateTag`. The reference material's `GET/POST /api/projects` and `PATCH/DELETE /api/projects/[projectId]` (`No_touch_ai/.../06-project-apis.md`) are therefore **not** built; `context/architecture-context.md` (directory layout, `app/editor/actions.ts` line) and `context/decision-log.md` D-024 already record this. Route handlers stay where the caller is not our UI or the body is a file (Liveblocks auth, webhooks, snapshot transfer). Consequence: a future public API or CLI needs a new feature with its own authz matrix.
- **PROPOSED D-025 — Side-effect seam for external systems.** Project actions call `ProjectExternals` (`lib/projects/externals.ts`) rather than importing `lib/liveblocks.ts` / `lib/blob.ts` directly. F03 ships no-op implementations with structured warnings; F05 fills `ensureRoom`/`deleteRoom`/`kickUsers`, F13 fills `deleteSnapshot`. Rationale: F03 is testable in isolation; the dependency direction (`lib → SDK`) is unchanged.
- **PROPOSED D-026 — Cache tag scheme.** `projects:owned:{userId}`, `projects:shared:{userId}`, `project:{projectId}` (F12 adds `project:{projectId}:members`). List functions tag themselves with every project id they return, so a rename/delete invalidates every member's list with one `updateTag('project:{id}')`. No email appears in any cache key or tag (Next docs: keys/tags are stored in plain text).

## Reference material

- `context/domain-model.md` (entities, role resolution, invariants 1–4, 7), `context/security-model.md` (authorization rules 1–5, deletion lifecycle), `context/data-ownership.md` (rows 2–3, rule 7), `context/code-standards.md` (Next 16 rules 3, 5; data access), `context/testing-strategy.md` (L2 Neon test branch, AUTHZ-MATRIX).
- Research (checked 2026-10-22): `scratchpad/research/services.md` §B2 (Prisma 7 config, generator `output`, `dotenv/config`, Neon adapter, npm `latest` is Prisma 8 RC — pin `~7.10`); `scratchpad/research/nextjs-testing.md` §1 (`'use cache'` rules, `cacheTag`/`updateTag`, no runtime data inside cache scopes), §6 (Server Actions return values, `updateTag` same-response re-render); `scratchpad/research/liveblocks.md` §9 (`getOrCreateRoom(roomId, { defaultAccesses: [] })`, `deleteRoom` does not throw if missing; whether `deleteRoom` disconnects connected users is UNVERIFIED).
- Reference prompts (product intent only): `No_touch_ai/.../05-prisma.md` (models, singleton — we diverge: no `prisma/models/*.prisma`, no Accelerate branch, no `DRAFT` status, no `ProjectCollaborator` naming), `06-project-apis.md` (REST — superseded by D-024).
