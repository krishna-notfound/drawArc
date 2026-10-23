# F03 — Test Plan

Layers and commands per `context/testing-strategy.md`. L2 runs against `DATABASE_URL_TEST` (Neon test branch, `prisma migrate reset --force` before the suite). Clerk is replaced at the `lib/auth.ts` seam: `tests/setup/auth-seam.ts` exposes `asUser(user)` / `asAnonymous()` which make `requireUser()` resolve `{ user }` or throw `AccessError('UNAUTHENTICATED')`. `next/cache` is stubbed by `tests/setup/next-cache-stub.ts` (`updateTag`, `cacheTag`, `cacheLife` record calls); the real invalidation behaviour is verified at L3 in F04 (sidebar updates after create/rename/delete).

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L0 | `tests/unit/prisma-config.test.ts` | repo files | read `package.json`, `prisma/schema.prisma`, `.gitignore`, `prisma.config.ts` source | pins `~7.10`; generator `prisma-client` + `output`; `DATABASE_URL_UNPOOLED` referenced; `lib/generated/` ignored |
| TC-002 | AC-002 | L1 | `tests/unit/prisma-singleton.test.ts` | `vi.resetModules`, env stub | import `lib/prisma` twice (dev); set `NODE_ENV=production`, import again | same instance in dev; `globalThis.__prisma` undefined in prod |
| TC-003 | AC-003 | L2 | `tests/integration/schema.test.ts` | migrated test branch | query `information_schema.columns`, `pg_indexes`, `table_constraints` | columns/indexes/unique/cascade as specified |
| TC-004 | AC-004 | L2 | `tests/integration/schema.test.ts` | `makeUser(A)`, `makeProject(A)`, 2× `makeMember` | `prisma.project.delete` | member count 0; user A present |
| TC-005 | AC-005 | L2 | `tests/integration/access.test.ts` | matrix fixtures: owner A; editor B (bound); viewer C (bound); pending D (email-only, mixed case stored lower); stranger E; F whose email matches a row bound to B | `getProjectRole` for each | `owner`, `editor`, `viewer`, `editor`/`viewer` per row, `null`, `null` |
| TC-006 | AC-006 | L2 | `tests/integration/access.test.ts` | Prisma client with query-event spy | call with 4 malformed ids | all `null`; 0 query events |
| TC-007 | AC-007 | L2 | `tests/integration/access.test.ts` | project P (owner with `deletedAt`), member B | `getProjectRole(B, P)`; `getProjectRole(B, randomCuid)` | `null`, `null` |
| TC-008 | AC-008 | L2 | `tests/integration/access.test.ts` | pending member D | `Promise.all([getProjectRole(D,P), getProjectRole(D,P)])`; read row | both roles equal; `userId = D.id`; `acceptedAt` set once |
| TC-009 | AC-009 | L2 | `tests/integration/access.test.ts` | `asUser` per role | 3 roles × 3 `atLeast` | resolves iff rank ok; else `AccessError.code === 'FORBIDDEN'` |
| TC-010 | AC-010 | L2 | `tests/integration/access.test.ts` | stranger E | `requireProjectRole(P, 'viewer')`, `requireProjectRole(missing, 'viewer')` | `JSON.stringify` of both errors identical |
| TC-011 | AC-011 | L2 | `tests/integration/access.test.ts` | P archived | 4 calls per table in AC-011 | ok / `PROJECT_ARCHIVED` / `PROJECT_ARCHIVED` / ok |
| TC-012 | AC-012 | L1 | `tests/unit/project-schemas.test.ts` | — | `safeParse` the 7 inputs | results as in AC-012 |
| TC-013 | AC-013 | L2 | `tests/integration/project-actions.test.ts` | `asUser(A)`, fake externals (spies) | `createProject({ name: 'Billing' })` | row fields; `ensureRoom(id)` once; `updateTag('projects:owned:A')` |
| TC-014 | AC-014 | L2 | `tests/integration/project-actions.test.ts` | `ensureRoom` rejects; logger spy | `createProject({})` | `ok: true`; name `Untitled Project`; `warn` with `op: 'ensureRoom'` |
| TC-015 | AC-015 | L2 | `tests/integration/project-actions.test.ts` | owner A, project P | `renameProject({ projectId: P, name: 'New', description: 'd' })` | row updated; data echo; `updateTag('project:P')` |
| TC-016 | AC-016 | L2 | `tests/integration/project-actions.test.ts` | P archived | `renameProject` | `CONFLICT` + `PROJECT_ARCHIVED`; name unchanged |
| TC-017 | AC-017 | L2 | `tests/integration/project-actions.test.ts` | P active | archive ×2, unarchive ×2 | all ok; statuses; tags each call |
| TC-018 | AC-018 | L2 | `tests/integration/project-actions.test.ts` | P with members B, C (bound), D (pending), `canvasBlobPath` set | `deleteProject` | rows gone; `kickUsers(P, [A,B,C])`; call order kick → deleteSnapshot → deleteRoom |
| TC-019 | AC-019 | L2 | `tests/integration/project-actions.test.ts` | `deleteRoom`, `deleteSnapshot` reject | `deleteProject` | `ok: true`; row gone; 2 `error` logs with `projectId` |
| TC-020 | AC-020 | L3 | `tests/e2e/project-delete-kick.spec.ts` | two Clerk contexts; A owns P; B invited editor (F12); both in workspace | A deletes P via sidebar | B shows AccessDenied ≤ 5 s; B's WS closed (`useStatus` not `connected`) — **deferred until F05+F12** |
| TC-021 | AC-021 | L2 | `tests/integration/project-lists.test.ts` | A owns P1; B owns P2 with A bound editor | call both list functions | `[P1]`; `[P2 role editor ownerName B.name]`; recorded tags |
| TC-022 | AC-022 | L2 | `tests/integration/project-lists.test.ts` | + pending row for A on P3 | `listSharedProjects(A)` | P3 absent |
| TC-023 | AC-023 | L2 | `tests/integration/project-lists.test.ts` | P2 owner `deletedAt` set; then P2 archived | both list functions | P2 absent in both variants |
| TC-024 | AC-024 | L1 | `tests/unit/action-errors.test.ts` | logger spy | `toActionError` with 5 inputs | codes mapped; `fieldErrors.name`; one `error` log |
| TC-025 | AC-025 | L2 | `tests/integration/project-actions.test.ts` | `renameProject({ projectId: 'nope' })`; second run with a Prisma client pointed at an unreachable host | call | `VALIDATION`; `UPSTREAM`; no throw |
| TC-026 | AC-026 | L2 | `tests/integration/authz-matrix.projects.test.ts` | stranger C; B's project; random cuid | 4 actions × 2 ids | all deep-equal the FORBIDDEN result |
| TC-027 | AC-027 | L0 | `tests/unit/no-project-rest-routes.test.ts` | — | glob `app/api/projects/**/route.ts` excluding `canvas/` | zero matches |
| TC-028 | AC-028 | Manual | reviewer | — | `rg -n "findMany\(" lib/access.ts lib/projects/` | every call scoped; output pasted in status.md |
| TC-029 | AC-029 | L2 | `tests/integration/authz-matrix.projects.test.ts` | `asAnonymous()` | 5 actions | `UNAUTHENTICATED`; row counts unchanged |
| TC-030 | AC-030 | L2 | `tests/integration/authz-matrix.projects.test.ts` | editor, viewer, owner of P | 4 owner-only actions × 3 roles | editor/viewer `FORBIDDEN` + unchanged; owner ok |

## AUTHZ-MATRIX (mandatory)

| Action | unauthenticated | non-member (foreign id) | non-member (missing id) | viewer | editor | owner |
|---|---|---|---|---|---|---|
| `createProject` | `UNAUTHENTICATED` | n/a (no project) | n/a | ok | ok | ok |
| `renameProject` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok (`CONFLICT` if archived) |
| `archiveProject` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok |
| `unarchiveProject` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok |
| `deleteProject` | `UNAUTHENTICATED` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | `FORBIDDEN` | ok |
| `getProjectRole` (function) | n/a | `null` | `null` | `viewer` | `editor` | `owner` |

Plus the email-only binding case (TC-005, TC-008) as required by testing-strategy "Authorization tests".

## Collaboration / concurrency cases

F03 touches the room only through the seam. Covered here: concurrent bind (TC-008), rename/delete race (TC-025 variant: run `deleteProject` then `renameProject` → `NOT_FOUND`... asserted inside TC-025's file as `TC-025b`). Covered later: owner deletes while members connected (TC-020, L3, after F05/F12).

## Not tested automatically (and why)

- Real `updateTag` invalidation and same-response re-render: needs the Next runtime; verified at L3 in F04 (`tests/e2e/editor-home.spec.ts`).
- Real `getOrCreateRoom`/`deleteRoom`/Blob `del`: owned by F05/F13 test plans; here only the seam contract (call, order, failure tolerance) is asserted.
- Migration against production: performed by `prisma migrate deploy` in the Vercel build; verified by the preview deployment in F15.
- Performance of list queries: trivially indexed; no perf test in M1.
