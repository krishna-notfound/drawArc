# F10 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and verified (combined with F14); PR open |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 6, own worktree |
| Last verified | 2026-10-24, `a67d7dd` + merge `d009507` + test fixes |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F06–F09 contracts, `research/react-flow.md` §4, §6, §8, §9, §13, `research/liveblocks.md` §3, reference prompt 17 and `current-issues-workspace-implementation.md` §2.
- 2026-10-22 — Gate 4 audit fixes applied (cheat-sheet row synced to ui-context, TC-011/026/027 AC links, Manual TC-028). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `962f83e` shortcut map, ignore rules, cheat-sheet copy, duplicate helper · `3f1e315` canvas commands + window keyboard handler · `7087d47` control bar, context menu (shadcn ContextMenu, D-10b), cheat-sheet · `36f7a56` e2e single-user + two-user · `a67d7dd` e2e context-menu settle fix.

| Check | Result |
|---|---|
| Agent gate | check 495/495, build OK, e2e 62/63 (shared page-load timeout, spec 7/7 on rerun), audit 0 |
| Round-6 combined (F14 merged into F10, merge `d009507` + test fixes `a449a35`, `aa2f741`) | typecheck/lint/prisma pass, unit 496/497 (project-list 5 s timeout under load, passes alone), build OK, e2e 64/65 (F12 `sharing.spec.ts:130` removal flake, passes alone), F09 undo test 3/3 repeated, audit 0 |

AC mapping (agent): unit 006, 009–011, 013, 019; e2e single-user 001–004, 007, 008, 012, 015–018, 020, 022; two-user 005, 008, 014, 021, 023; AC-024 visual check pending (owner).

Rulings: context-menu target read from the clicked element (React Flow swallows pane right-clicks while right-drag panning is on); control bar re-reads undo/redo state just after each change (Liveblocks reports canRedo before clearing the redo stack); EC-011 corrected — Space+drag on a node moves the node (React Flow 12), Space+drag on empty canvas pans; Next.js dev indicator moved bottom-right (dev only) so it does not cover Zoom out; optional `?` button on the control bar omitted (the `?` shortcut opens the cheat-sheet).

## Open issues
- D-10b: shadcn `ContextMenu` instead of the brief's `DropdownMenu` — owner to confirm (adds one generated component).
- D-10c: "bring to front / send to back" dropped from M1 because `zIndex` is not synced by `@liveblocks/react-flow`; `context/ui-context.md` "Context menu" row already reflects this (Gate 4) and the cheat-sheet table in 01-requirements.md was re-synced to it.
- Store action names for programmatic selection are UNVERIFIED; fallback via local `select` changes documented.
- Redo-stack clearing on new change is assumed standard Liveblocks behaviour (UNVERIFIED on fetched pages); AC-022 asserts it.
- Optional `?` ghost button in the control bar (T-006) is beyond the brief; drop if unwanted.
- Aligned with F06's drafted package (2026-10-22): zoom range 0.1–4 (F06/FR-008), viewers have `elementsSelectable: false` so selection shortcuts/menu rows are omitted for them, island is `flow-canvas.tsx`, prop guard extends F06's `flow-canvas.test.tsx`.
- Known limitation (Liveblocks 3.24.4): an undo within ~1 s of a delete can be lost — the server's delete acknowledgement re-deletes the restored item. Tests wait 1 s; real users can still hit it.
- Owner decision pending: the project sidebar (open by default on desktop) covers the bottom-left control bar.
- AC-024 visual check pending (owner).
