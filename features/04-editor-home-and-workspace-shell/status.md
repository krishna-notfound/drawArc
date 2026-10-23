# F04 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-027 (`useTransition` over `useActionState` in `useProjectDialogs`), D-028 (workspace slot contract), D-029 (`@axe-core/playwright` dev dependency).
- 2026-10-22 — Gate 4 audit fixes applied (F01 component reuse, seed hook point D-034, `presenceSlot` replaces the default user button, no `console.error` in `error.tsx`). See `features/AUDIT-2026-10-22.md`.

## Evidence
- none yet.

## Open issues
- Resolved at Gate 4: `requireUser()` defaults to `'throw'` (F02 D-F02-2), so the gate handles `AccessError('UNAUTHENTICATED')` only and redirects with `returnTo`; the dead `NEXT_REDIRECT` branch was removed from 02-design. F01's shell components are reused (modified), not re-created; the project sidebar defaults open at ≥ 1024 px (overrides F01 D-F01-4 as F01 permitted). The gate now contains F13's seed hook point (D-034).
- **Archived projects** are reachable by URL (workspace shows an "Archived" badge, island role `viewer`) but have no list or unarchive affordance in M1 — same open issue as F03.
- **Description field** exists in the schema but the Create/Rename dialogs expose name only (PROPOSED). Confirm or add a `Textarea`.
- **D-029** adds a dev dependency not in `architecture-context.md`'s test row; decline → TC-025 becomes keyboard-only assertions.
- **AC-023** needs a dedicated Playwright project with a broken `DATABASE_URL`; if CI cannot provide it, downgrade to Manual (reviewer stops the DB locally and records the screenshot).
