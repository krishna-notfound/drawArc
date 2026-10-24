# F04 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #6 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — implementation agent in its own git worktree, in parallel |
| Last verified | 2026-10-24, `193626f`; combined round-2 check with F05 at `0dff1a6` |

## History
- 2026-10-22 — drafted by planning session (spec writer). Introduces PROPOSED D-027 (`useTransition` over `useActionState` in `useProjectDialogs`), D-028 (workspace slot contract), D-029 (`@axe-core/playwright` dev dependency).
- 2026-10-22 — Gate 4 audit fixes applied (F01 component reuse, seed hook point D-034, `presenceSlot` replaces the default user button, no `console.error` in `error.tsx`). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `927129d` sidebar lists, dialogs, editor home · `ce5bcc7` gated workspace page, slots, seed hook stub · `d77164e` per-dialog field ids · `193626f` e2e owner flow, gate matrix, AI-panel axe scan.

| Check | Result |
|---|---|
| Agent gate (own worktree) | check 303/303, build OK (`◐ /editor`, `◐ /editor/[projectId]`), e2e 32 passed, audit 0 |
| Round-2 combined (F04 merged into F05, main session) | check 327/327, build OK, e2e 33 passed / 1 skipped |
| GitHub CI | PR #6 pass |

AC mapping (agent): e2e owner flow 007/008/010/013/015/024/025; e2e home 001; e2e gate 016–019/021/022 + AI-panel axe (F01 AC-027); unit 005/011/012; build/inspection 002/014/027; existing tests/inspection 003/004/006/009/020/023/026 (AC-023 no automated test — needs a second dev server with a broken DB URL).

Rulings: sidebar lists stream as one region; sidebar default-open ≥1024px without stealing focus (`openSidebarOnDesktop`); dialogs return focus via `onCloseAutoFocus`; FORBIDDEN on rename/delete shown as "That project no longer exists."; e2e seeds other users' projects directly in the dev DB (no user B, F12 not built); `lib/access.ts` project now carries `canvasBlobPath`/`canvasSchemaVersion` for the seed stub.

## Open issues
- Resolved at Gate 4: `requireUser()` defaults to `'throw'` (F02 D-F02-2), so the gate handles `AccessError('UNAUTHENTICATED')` only and redirects with `returnTo`; the dead `NEXT_REDIRECT` branch was removed from 02-design. F01's shell components are reused (modified), not re-created; the project sidebar defaults open at ≥ 1024 px (overrides F01 D-F01-4 as F01 permitted). The gate now contains F13's seed hook point (D-034).
- **Archived projects** are reachable by URL (workspace shows an "Archived" badge, island role `viewer`) but have no list or unarchive affordance in M1 — same open issue as F03.
- **Description field** exists in the schema but the Create/Rename dialogs expose name only (PROPOSED). Confirm or add a `Textarea`.
- **D-029** adds a dev dependency not in `architecture-context.md`'s test row; decline → TC-025 becomes keyboard-only assertions.
- **AC-023** needs a dedicated Playwright project with a broken `DATABASE_URL`; if CI cannot provide it, downgrade to Manual (reviewer stops the DB locally and records the screenshot).
- Hidden previous pages kept by Next after client navigation duplicate fixed ids (`project-sidebar`, `ai-sidebar`), so `aria-controls` may target a hidden copy — revisit in F06/F16.
