# F10 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F06–F09 contracts, `research/react-flow.md` §4, §6, §8, §9, §13, `research/liveblocks.md` §3, reference prompt 17 and `current-issues-workspace-implementation.md` §2.
- 2026-10-22 — Gate 4 audit fixes applied (cheat-sheet row synced to ui-context, TC-011/026/027 AC links, Manual TC-028). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-005 Radix/React Flow event-order prototype note, `npm run check` logs, AC-024 screenshots.

## Open issues
- D-10b: shadcn `ContextMenu` instead of the brief's `DropdownMenu` — owner to confirm (adds one generated component).
- D-10c: "bring to front / send to back" dropped from M1 because `zIndex` is not synced by `@liveblocks/react-flow`; `context/ui-context.md` "Context menu" row already reflects this (Gate 4) and the cheat-sheet table in 01-requirements.md was re-synced to it.
- Store action names for programmatic selection are UNVERIFIED; fallback via local `select` changes documented.
- Redo-stack clearing on new change is assumed standard Liveblocks behaviour (UNVERIFIED on fetched pages); AC-022 asserts it.
- Optional `?` ghost button in the control bar (T-006) is beyond the brief; drop if unwanted.
- Aligned with F06's drafted package (2026-10-22): zoom range 0.1–4 (F06/FR-008), viewers have `elementsSelectable: false` so selection shortcuts/menu rows are omitted for them, island is `flow-canvas.tsx`, prop guard extends F06's `flow-canvas.test.tsx`.
