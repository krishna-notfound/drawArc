# F07 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F06 contracts, `research/react-flow.md`, `research/liveblocks.md`, reference prompts 12/13 and the two `current-issues` files.
- 2026-10-22 — Gate 4 audit fixes applied (AC-016 single layer, AC-023 FR link, TC-025/TC-026 traceability). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 spike output, `npm run check` logs, preview URL, AC-015 screenshot go here.

## Open issues
- D-07a hinges on the UNVERIFIED assumption that `useLiveblocksFlow().onNodesChange` honours `add`/`replace` changes; T-001 is a gating spike.
- Aligned with F06's drafted package on 2026-10-22: island is `components/canvas/flow-canvas.tsx`, registry is `components/canvas/node-types.ts`, `ulid@^2` is installed by F06, E2E flag is `NEXT_PUBLIC_E2E_HOOKS`, F07 removes F06's `DevAddNode`. Re-check if F06 changes before approval.
- Store action `unselectNodesAndEdges` name UNVERIFIED (fallback documented in 02-design).
