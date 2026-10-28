# F08 — Status

| Field | Value |
|---|---|
| Status | Completed (v1) · v2 Approved — implementation authorized (2026-10-28, D-066) |
| Spec approved | v1: 2026-10-24, owner (incl. its local decisions) · v2: — |
| Implementation authorized | v1: 2026-10-24, owner — parallel round 5, own worktree · v2: — (T-008–T-014) |
| Last verified | v1: 2026-10-24, `b0a6020`; combined round-5 check at `9bd1d62` + test fix · v2: — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F07 contracts, `research/react-flow.md` §5–§7, `research/liveblocks.md` §1–§3, reference prompts 14/15.
- 2026-10-22 — Gate 4 audit fixes applied (FR links on AC-021–024, TC-011/TC-026 AC links, Manual TCs for AC-007/AC-016, ROLE_CHANGED wording). See `features/AUDIT-2026-10-22.md`.
- 2026-10-28 — **v2 increment drafted** by the spec writer into the same package (sections "v2 — richer node editing" in 00–05): Shift keep-aspect, auto-grow height, text options, border, custom hex, properties toolbar, batched multi-node mutations. Adds FR-015–FR-027, EC-014–EC-023, AC-025–AC-041, T-008–T-014, TC-029–TC-043. Research R-007/R-008/R-024/R-027/R-028/R-029/R-031/R-048; decisions D-053, D-057, D-063; proposed D-08e/f/g. React Flow 12.12.0 resizer facts re-verified against `node_modules` (02-design). Not approved; no code.
- 2026-10-28 — v2 approved by owner with batch 1 (D-066); the 14 local decisions in `docs/research/batch1-owner-decisions.md` adopted as recommended. Implementation authorized (Sonnet 5.5 agent, own worktree).

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

### v2 open decisions (owner input needed before approval)
- **O-v2-1 — FR-016 Alt-resize-from-centre (P3):** include in v2 or drop? Recommendation: drop (low value for labelled nodes, extra change emission per move); keep the FR text as reserved.
- **O-v2-2 — Auto-grow cap:** `AUTO_GROW_MAX_HEIGHT = 480` px proposed (≈ 20 lines at 14 px / 1.3 plus padding; 200-char labels rarely exceed it). Alternatives: 320 (tighter) or none (unbounded nodes). Recommendation: 480.
- **O-v2-3 — Resolved at validation (2026-10-28):** derived text colour pair = pure `#FFFFFF` / `#000000` (option A, D-08g) in the one shared `lib/canvas/color.ts`; F22 FR-004 and `context/domain-model.md` aligned; no refusal path for filled kinds (the hex input refuses only a `text`-kind hex that fails against `--bg-base`, FR-023).
- **O-v2-4 — Resolved at validation (2026-10-28):** one properties toolbar owned by F08 v2 for every kind (FR-024 visibility rules); F22's toolbar removed from its 02-design/T-006, F22 provides `TEXT_OPTION_KINDS` / `DEFAULT_TEXT` / `TEXT_SIZE_PX` only and its AC-016 is verified in F08's toolbar test file.
- **O-v2-5 — Resize-end fit and undo granularity:** if T-008 shows `history.pause/resume` cannot bracket the hook's gesture, accept a second undo step for the fit write (FR-018 fallback) or drop the resize-end fit and rely on `minHeight` alone. Recommendation: fallback A (second step), recorded here.
- **O-v2-6 — `border.style: 'dotted'`:** F22 reserves it in the schema; F08 v2 renders it but offers no UI (task scope: none/solid/dashed). Confirm, or add a fourth radio.
- **Dependency note:** T-010–T-012 are blocked until F22's schema v2 (`data.text`, `data.border`, `NodeColor`, `TEXT_SIZE_PX`, `MIN_SIZES`, `DEFAULT_TEXT`, `DEFAULT_BORDER`, `TEXT_OPTION_KINDS`, `resolveColor`, `measureText`) is merged; F22 T-006 in turn waits for T-012; F10 FR-008 (`selectionKeyCode="Shift"`) is already on `main`.
- Resolved at validation (2026-10-28): schema field names checked against F22 02-design and `context/domain-model.md` — `data.border.style` now lists `dotted`, defaults are `DEFAULT_TEXT[kind]` / `DEFAULT_BORDER[kind]`, `MIN_SIZE` → `MIN_SIZES[kind]`, hex casing per F22 FR-004 (schema accepts either case, F08 writes lowercase).
