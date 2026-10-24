# F08 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #13 (2026-10-24) |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 5, own worktree |
| Last verified | 2026-10-24, `b0a6020`; combined round-5 check at `9bd1d62` + test fix |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F07 contracts, `research/react-flow.md` §5–§7, `research/liveblocks.md` §1–§3, reference prompts 14/15.
- 2026-10-22 — Gate 4 audit fixes applied (FR links on AC-021–024, TC-011/TC-026 AC links, Manual TCs for AC-007/AC-016, ROLE_CHANGED wording). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `398dbbb` resize + inline label editing · `97a0f82` colour toolbar for the selection · `b0a6020` node-editing e2e + `window.__history` hook.

| Check | Result |
|---|---|
| Agent gate | check 463/463, build OK, all 5 F08 e2e pass (full suite had load flakes in other features' specs) |
| Round-5 combined (F08 merged into F09, main session) | check 484/484, build OK, e2e 56/56 |
| GitHub CI | PR #13 pass |

AC mapping (agent): e2e 001, 003–006, 010–012, 014, 017–019; unit 008–011, 014, 015, 017, 018; inspection/screenshots 002, 013, 020; manual (owner) 007, 016 (screenshots in the agent ledger folder); not automated (lean, documented Liveblocks behaviour) 021–024.

Rulings: one change call per colour update is one undo step (Liveblocks batches); resizer = 4 corner handles + 4 edge lines with a widened invisible grab area; typing keys stopped on the textarea itself (React stopPropagation is too late); Strict Mode label-commit bug fixed; empty-node hint shown to editors only.

## Open issues
- D-08a (commit-on-close label buffering) is now the wording in `context/architecture-context.md` "Canvas architecture" ("written on commit (Enter/blur), not per keystroke (F08 D-08a)"); owner approval at Gate 5 still required. Fallback designed (history pause/resume).
- Aligned with F06's drafted package (2026-10-22): schema label bound is 500 (looser than this feature's 200 UX cap — compatible); viewers have `elementsSelectable: false`, so viewer ACs assert "cannot select" rather than "selected node shows nothing"; island is `components/canvas/flow-canvas.tsx`.
- `room.batch()` around the hook handler for one-undo-step multi-node colour is UNVERIFIED until T-001.
- F12 AC-023 "unsynced edits" check still not added.
