# F03 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and independently verified; PR open |
| Spec approved | 2026-10-24, owner (incl. local decisions D-024 … D-026) |
| Implementation authorized | 2026-10-24, owner — one implementation agent; migration 2 (`Project`, `ProjectMember`) on Neon `development` ONLY |
| Last verified | 2026-10-24, commit `46d8037` on `feat/f03-projects-data-layer-and-api` |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-024 (no REST project routes in M1), D-025 (externals seam), D-026 (cache tag scheme).
- 2026-10-22 — Gate 4 audit fixes applied (D-036 ownership, migration naming, Prisma ownership). See `features/AUDIT-2026-10-22.md`.

- 2026-10-24 — Implemented by implementation agent in 2 commits (`46eaf29`, `46d8037`); verified by main session. No separate review pass (owner time limit); CI on the PR is the second check.
## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `46eaf29` Project/ProjectMember schema, migration 2, role resolver · `46d8037` Server Actions, cached lists, externals seam.

| Check | Result (2026-10-24, main session) |
|---|---|
| `npm run check` | exit 0 — 296/296 tests (18 new F03 integration tests on Neon `development` throwaway schema) |
| `npm run build` | exit 0 (no new routes by design) |
| `npm run e2e` | 25 passed on rerun; first run had 1 flaky `ERR_ABORTED` on cold `/editor` navigation (known dev-server cold-start flake, also seen in F02) |
| Neon | migration `20261024120000_projects_and_members` on `development` (tables: Project, ProjectMember, User, _prisma_migrations); `production` public tables = 0 |

AC mapping (agent): 001–002 pin test + `prisma validate`; 003–011 `access.test.ts`; 012/024/027 `project-boundaries.test.ts`; 013–019, 021–023, 025, 026, 029, 030 `actions.test.ts`; 028 grep — every `findMany` scoped; 020 deferred to F05/F12 (room seam).

Rulings: six spec test files merged into two (lean testing); `bindPendingMemberships` moved to `lib/memberships.ts` (same signature); `user.deleted` removes bound memberships, keeps email-only pending invites; archived rename uses existing error type with `archived` reason; cache tag names in `lib/projects/tags.ts`. Local decisions D-024 (Server Actions only), D-025 (ProjectExternals seam), D-026 (cache tags) approved with the spec.


## Open issues
- Resolved at Gate 4 (2026-10-22): Prisma setup is owned by F02 (F03 verifies only); `lib/errors.ts` types are owned by F00 (D-036) and F03 adds only `toActionError`; F02's `requireUser()` throws F00's `AccessError('UNAUTHENTICATED')` by default (F02 D-F02-2); `architecture-context.md` and the decision log already record D-024 (no REST project routes).
- **Archive has no UI in M1**: `archiveProject`/`unarchiveProject` exist and are tested (O-4) but F04 exposes only rename/delete. Owner to confirm this is acceptable or assign an "Archived" filter to a later feature.
- **Deleting a project while members are connected**: `kickUsers` through the seam (EC-010) relies on F12's `useKickListener` reload behaviour; whether `deleteRoom` disconnects clients is UNVERIFIED.
- AC-020 / TC-020 are deferred until F05 and F12 are implemented.
- `lib/projects/queries.ts` (`'use cache'`) is not imported by any page yet; type-checked only — F04 exercises it in a build.
- Binding a pending invite during a page render cannot call `updateTag` (Server Actions only), so "Shared with me" may lag up to the cache lifetime (accepted by spec).
- e2e cold-start flake on `/editor` (ERR_ABORTED) — consider a warm-up navigation in `global.setup.ts` (F04).
