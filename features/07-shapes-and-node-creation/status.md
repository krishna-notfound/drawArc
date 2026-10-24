# F07 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #10 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 4, own worktree |
| Last verified | 2026-10-24, `bd380fa`; combined round-4 check at `42becbf` |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F06 contracts, `research/react-flow.md`, `research/liveblocks.md`, reference prompts 12/13 and the two `current-issues` files.
- 2026-10-22 — Gate 4 audit fixes applied (AC-016 single layer, AC-023 FR link, TC-025/TC-026 traceability). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `9603d06` six shapes, four handles, memoised node · `5c11443` typed write path (`useCanvasMutations`) + drop maths · `7592b0d` palette, drag ghost, keyboard placement; F06 dev button removed · `58f1287` e2e (drops, handles, two-user sync, viewer gate) · `bd380fa` comment fix.

| Check | Result |
|---|---|
| Agent gate | check 418/418, build OK, e2e 44 passed, audit 0 |
| Round-4 combined (F07 merged into F11, main session) | check 428/428, build OK, e2e 44/45 — 1 known cold-start `ERR_ABORTED` navigation flake in F02 auth AC-009 (passes alone, twice) |
| GitHub CI | PR #10 pass |

AC mapping (agent): unit 003, 005, 006, 007, 008 (real screenToFlowPosition, four zooms + pan), 009; e2e 002, 004, 008, 010, 011, 012, 013, 016, 017, 020, 021 + F12 AC-024 (viewer cannot drag); inspection 014, 018, 019, 022; not tested (lean): 019 render count, 023 offline queue; 015 screenshot needs a human (draft in the agent ledger folder).

Rulings: spike T-001 settled from Liveblocks source + two-user e2e; writes go through the React Flow store into F06's Liveblocks handlers; node aria-label on the inner element (frozen schema unchanged).

## Open issues
- D-07a hinges on the UNVERIFIED assumption that `useLiveblocksFlow().onNodesChange` honours `add`/`replace` changes; T-001 is a gating spike.
- Aligned with F06's drafted package on 2026-10-22: island is `components/canvas/flow-canvas.tsx`, registry is `components/canvas/node-types.ts`, `ulid@^2` is installed by F06, E2E flag is `NEXT_PUBLIC_E2E_HOOKS`, F07 removes F06's `DevAddNode`. Re-check if F06 changes before approval.
- Store action `unselectNodesAndEdges` name UNVERIFIED (fallback documented in 02-design).
- E2E test hooks ship in production code but never mount there.
