# F08 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F07 contracts, `research/react-flow.md` §5–§7, `research/liveblocks.md` §1–§3, reference prompts 14/15.
- 2026-10-22 — Gate 4 audit fixes applied (FR links on AC-021–024, TC-011/TC-026 AC links, Manual TCs for AC-007/AC-016, ROLE_CHANGED wording). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 spike output, `npm run check` logs, AC-007/AC-016 screenshots.

## Open issues
- D-08a (commit-on-close label buffering) is now the wording in `context/architecture-context.md` "Canvas architecture" ("written on commit (Enter/blur), not per keystroke (F08 D-08a)"); owner approval at Gate 5 still required. Fallback designed (history pause/resume).
- Aligned with F06's drafted package (2026-10-22): schema label bound is 500 (looser than this feature's 200 UX cap — compatible); viewers have `elementsSelectable: false`, so viewer ACs assert "cannot select" rather than "selected node shows nothing"; island is `components/canvas/flow-canvas.tsx`.
- `room.batch()` around the hook handler for one-undo-step multi-node colour is UNVERIFIED until T-001.
