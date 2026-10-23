# F03 — Implementation Plan (outline)

**Dependencies to be installed**: none — `prisma@~7.10`, `@prisma/client@~7.10`, `@prisma/adapter-neon@~7.10`, `@neondatabase/serverless@^1.2`, `dotenv` and `zod` are installed by F02/F00. Pins per D-023; `npm audit --audit-level=high` must stay clean.

**Environment variables**: none new. `DATABASE_URL` (pooled, runtime) and `DATABASE_URL_UNPOOLED` (direct, CLI) are already declared by F02/`lib/env.ts`; `DATABASE_URL_TEST` for L2 per testing-strategy.

**Migrations**: one — `projects_and_members` (the repo's second migration, after F02's migration 1 `user`). **Requires separate owner authorization at Gate 6 before `prisma migrate dev` is run against any shared branch.** Local development runs it against a personal Neon dev branch; CI/Vercel apply via `prisma migrate deploy` with `DATABASE_URL_UNPOOLED`.

**Ownership (resolved at Gate 4)**: F02 owns the Prisma 7 setup (`prisma.config.ts`, `lib/prisma.ts`, generator settings) and migration 1; F03 owns migration 2 and *verifies* the setup. T-001 is therefore a conformance task only: it checks the F02 files against FR-001/FR-002 and reports drift; it creates nothing.

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | Prisma 7 configuration conformance check (F02-owned files, verify only): `prisma.config.ts` (`dotenv/config`, `env('DATABASE_URL_UNPOOLED')`, `schema`, `migrations.path`), `prisma-client` generator with `output`, package pins `~7.10`, `.gitignore` entry, `lib/prisma.ts` singleton with `PrismaNeon`; `npm run check` includes `prisma validate`. Drift is reported to F02, not patched here. | FR-001, FR-002 | `tests/unit/prisma-config.test.ts`, `tests/unit/prisma-singleton.test.ts` (read-only checks of F02 files) | AC-001, AC-002 pass; `npx prisma generate` emits `lib/generated/prisma` |
| T-002 | `lib/errors.ts` addition: `toActionError` with Prisma/Zod/`AccessError` mapping and the user-safe message table (types from F00, D-036); unit tests. | FR-013 | `lib/errors.ts`, `tests/unit/action-errors.test.ts` | AC-024 passes |
| T-003 | Schema: `ProjectStatus`, `MemberRole`, `Project`, `ProjectMember`, `User` relation fields; migration `projects_and_members` generated locally (not applied to shared branches until authorised); `tests/factories.ts` `makeUser/makeProject/makeMember`; schema integration tests. | FR-003 | `prisma/schema.prisma`, `prisma/migrations/<ts>_projects_and_members/migration.sql`, `tests/factories.ts`, `tests/integration/schema.test.ts` | AC-003, AC-004 pass on the Neon test branch |
| T-004 | `schemas/project.ts` (`ProjectIdSchema`, `ProjectNameSchema`, `ProjectDescriptionSchema`, `CreateProjectInput`, `RenameProjectInput`, `ProjectIdInput`) + unit tests. | FR-008, FR-009 (validation half) | `schemas/project.ts`, `tests/unit/project-schemas.test.ts` | AC-012 passes |
| T-005 | `lib/access.ts`: `ROLE_RANK`, `resolveProjectAccess` (cuid pre-check, owner check, member by userId / email-with-null-userId, deleted-owner rule, idempotent bind), `getProjectRole`, `requireProjectRole` (archived rule). Integration tests: full matrix, concurrency bind, zero-query on bad id. | FR-004, FR-005, FR-006, FR-007, FR-014 | `lib/access.ts`, `tests/integration/access.test.ts` | AC-005–AC-011 pass |
| T-006 | `lib/projects/externals.ts` (`ProjectExternals`, `defaultExternals` no-op with `logger.warn`) and `lib/projects/service.ts` (`createProjectCore`, `renameProjectCore`, `setProjectStatusCore`, `deleteProjectCore` taking `{ user, project? }` + `externals`). | FR-008–FR-011 (logic), D-025 | `lib/projects/externals.ts`, `lib/projects/service.ts` | type-checks; used by T-007 |
| T-007 | `app/editor/actions.ts`: five `'use server'` actions following the skeleton in 02-design.md (requireUser → parse → requireProjectRole → core → `updateTag`), with `next/cache` stub + `requireUser` seam in tests; fake externals asserting call order; failure-path tests. | FR-008–FR-011, FR-013 | `app/editor/actions.ts`, `tests/integration/project-actions.test.ts`, `tests/setup/next-cache-stub.ts` | AC-013–AC-019, AC-025 pass |
| T-008 | `lib/projects/queries.ts`: `listMyProjects`, `listSharedProjects` with `'use cache'`, `cacheLife('minutes')`, `cacheTag(...)`, `ProjectListItem` mapping (ISO dates); integration tests with tag recording. | FR-012, FR-016 | `lib/projects/queries.ts`, `tests/integration/project-lists.test.ts` | AC-021–AC-023 pass |
| T-009 | AUTHZ-MATRIX suite for the five actions (unauthenticated, non-member on foreign and missing id, viewer, editor, owner) and the static no-REST-routes check. | FR-014, FR-015, FR-006 | `tests/integration/authz-matrix.projects.test.ts`, `tests/unit/no-project-rest-routes.test.ts` | AC-026, AC-027, AC-029, AC-030 pass |
| T-010 | Scoped-query review (AC-028) recorded in status.md; D-025/D-026 full text ready for the decision log (D-024 is already recorded there; `architecture-context.md` already lists `app/editor/actions.ts` instead of REST routes); `npm run check` + `npm run build` output attached. | FR-016, D-024 | `features/03-.../status.md` (evidence) | reviewer sign-off |
| T-011 (deferred) | Wire E2E AC-020 once F05 (`kickUsers`, `deleteRoom`) and F12 (`useKickListener`) exist: `tests/e2e/project-delete-kick.spec.ts`. | FR-011 | `tests/e2e/project-delete-kick.spec.ts` | AC-020 passes against a preview deployment |

Sequencing: T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010. T-004 and T-006 can run in parallel with T-005. Each task ≤ 1 day; T-005 and T-007 are the largest (~1 day each).

Hand-offs this feature creates for others:
- F05 replaces `defaultExternals.ensureRoom/deleteRoom/kickUsers` bodies with `lib/liveblocks.ts` calls (one-file change; F05 test plan must cover it).
- F13 replaces `defaultExternals.deleteSnapshot` with `lib/blob.ts` `del`.
- F04 consumes `listMyProjects`, `listSharedProjects`, the five actions, `requireProjectRole`, `AccessError`.
- F12 adds `project:{projectId}:members` tag and `updateTag('projects:shared:{userId}')` on invite/remove.

This is an outline; the detailed step-by-step plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace back to these task IDs.
