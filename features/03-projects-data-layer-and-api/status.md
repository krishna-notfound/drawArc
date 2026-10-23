# F03 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-024 (no REST project routes in M1), D-025 (externals seam), D-026 (cache tag scheme).
- 2026-10-22 — Gate 4 audit fixes applied (D-036 ownership, migration naming, Prisma ownership). See `features/AUDIT-2026-10-22.md`.

## Evidence
- none yet.

## Open issues
- Resolved at Gate 4 (2026-10-22): Prisma setup is owned by F02 (F03 verifies only); `lib/errors.ts` types are owned by F00 (D-036) and F03 adds only `toActionError`; F02's `requireUser()` throws F00's `AccessError('UNAUTHENTICATED')` by default (F02 D-F02-2); `architecture-context.md` and the decision log already record D-024 (no REST project routes).
- **Archive has no UI in M1**: `archiveProject`/`unarchiveProject` exist and are tested (O-4) but F04 exposes only rename/delete. Owner to confirm this is acceptable or assign an "Archived" filter to a later feature.
- **Deleting a project while members are connected**: `kickUsers` through the seam (EC-010) relies on F12's `useKickListener` reload behaviour; whether `deleteRoom` disconnects clients is UNVERIFIED.
- AC-020 / TC-020 are deferred until F05 and F12 are implemented.
