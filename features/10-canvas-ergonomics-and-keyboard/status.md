# F10 — Status

| Field | Value |
|---|---|
| Status | Completed (v1) · v2 Approved — implementation authorized (2026-10-28, D-066) |
| Spec approved | v1: 2026-10-24, owner (incl. its local decisions) · v2: — |
| Implementation authorized | v1: 2026-10-24, owner — parallel round 6, own worktree · v2: — (T-009–T-015) |
| Last verified | v1: 2026-10-24, `a67d7dd` + merge `d009507` + test fixes · v2: — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F06–F09 contracts, `research/react-flow.md` §4, §6, §8, §9, §13, `research/liveblocks.md` §3, reference prompt 17 and `current-issues-workspace-implementation.md` §2.
- 2026-10-22 — Gate 4 audit fixes applied (cheat-sheet row synced to ui-context, TC-011/026/027 AC links, Manual TC-028). See `features/AUDIT-2026-10-22.md`.
- 2026-10-28 — v2 "canvas productivity" drafted by the spec writer as a marked increment in every file (FR-014–FR-025, EC-014–EC-027, AC-025–AC-043, T-009–T-015, TC-029–TC-047; local decisions D-10f–D-10k) from `docs/research/excalidraw/00-summary.md` C3/C6 and R-001–R-004, R-009–R-012 under D-052–D-055, D-057. React Flow 12.12.0 props/hooks verified against `node_modules` (02-design v2 table). No code, no commits.
- 2026-10-28 — v2 approved by owner with batch 1 (D-066); the 14 local decisions in `docs/research/batch1-owner-decisions.md` adopted as recommended. Implementation authorized (Sonnet 5.5 agent, own worktree).

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
- Resolved 2026-10-24 (D-050): workspace sidebar closed by default, so it no longer covers the control bar.
- AC-024 visual check pending (owner).

### v2 open decisions (owner input needed before approval)
- **D-10f** clipboard transport: `writeText` + in-memory copy on write; keyboard paste from the `paste` event, menu paste via `readText` with memory fallback — confirm (alternative: `readText` everywhere, which prompts in Firefox).
- **D-10g** window key listener moves to the capture phase so Ctrl+Shift+Arrow beats React Flow's node nudge — confirm (touches every v1 shortcut path; v1 unit tests must stay green).
- **D-10h** Shift+2 with nothing selected = fit all — confirm or make it a no-op.
- **D-10i** grid snapping on drag only; inserted/pasted nodes are not rounded to the grid — confirm or ask for snap-on-insert.
- **D-10j** plain-text paste creates a text node only when F22's `text` kind is present — confirm the flag mechanism (`lib/canvas/kinds.ts` shim over F22's `NODE_KINDS`, F22 FR-002). *Resolved at validation (2026-10-28): the shortcut hand-over is now an explicit ordering rule in both packages (F10 D-10j / F22 FR-008) — registry owns `t`/`n`; whichever lands second wires them; the paste path calls F22's `addNodeOfKind('text', pos, { label })` and trims to F22's `TEXT_MAX_LENGTH`.*
- **D-10k** align/distribute use stored `width`/`height` — confirm.
- Grid preference in `localStorage` is drawArc's first client-side preference: authorise a `context/data-ownership.md` row at phase end.
- Letters reserved in `RESERVED_CHORDS` for F21/F22/F23/F24 (`x`, `t`/`n`, `f`, `i`): *Resolved at validation (2026-10-28) for `t`/`n` — they match F22 FR-008;* `x`/`f`/`i` stay provisional until the F21/F23/F24 overviews exist (placeholders in `features/README.md`).
- Resolved at validation (2026-10-28): naming checked against F22 — the `lib/canvas/kinds.ts` shim reads F22's `NODE_KINDS`, the align exclusion reads F22's optional `data.locked`, paste ids use `${kind}_` via `newNodeId(kind)`, and the migration helper is `migrate` (`lib/canvas/schema.ts`, as in F22), not `migrateCanvas`.
- Distribute has no default key (Excalidraw's Alt+H collides with AltGr layouts, 02 §F-S04): confirm menu/toolbar only.
- UNVERIFIED (02-design v2 table): Liveblocks redo stack surviving a remote change (AC-042 asserts it); clipboard permission behaviour outside Chromium (memory fallback covers it).
