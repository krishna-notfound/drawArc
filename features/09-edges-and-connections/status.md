# F09 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and verified (combined with F08); PR open |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 5, own worktree |
| Last verified | 2026-10-24, `beafa92` + merge `9bd1d62` + test fix |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F07 contracts, `research/react-flow.md` §2–§3, §14, `research/liveblocks.md` §1, §3, reference prompt 16 and `current-issues-workspace-implementation.md` §3.
- 2026-10-22 — Gate 4 audit fixes applied (AC-017 single layer, FR links on AC-020/021, TC-011/TC-023 AC links, Manual TC-024, schema label bound 500 consistent, `HandleId` owned by F06). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `1b1a4f7` connection rules, reconnection, attached-edge delete (does not type-check alone — fixed by the next commit; not amended per the no-rewrite rule) · `ee96e9e` edge renderer with arrowhead + inline label editor · `bb45897` Strict Mode label-save fix · `beafa92` e2e + `window.__history` hook; plus the round-5 merge and a test-locator fix (the edge hint copy equals F08's node hint).

| Check | Result |
|---|---|
| Agent gate | check 473/473, build OK, e2e 51/51, audit 0 |
| Round-5 combined (main session) | check 484/484, build OK, e2e 56/56 |

Merge conflicts resolved (main session): both sides' constants in `types/canvas.ts`, both style blocks in `globals.css`, both describe blocks in the useCanvasMutations test; the E2E `__history` hook uses F08's `useHistory` version (superset of F09's).

AC mapping (agent): unit 001, 006, 007, 010–013; e2e single-user 002–005 (all 16 handle pairs), 008, 014, 017, 019; two-user 009, 015, 016, 018; not automated 020, 021 (beyond the test list), 022 (manual screenshot).

Rulings: deleting a node also deletes its attached edges in the same onDelete (Liveblocks does not, and orphans would fail F13's schema check); the edge being reconnected is excluded from the duplicate check; drop-off on empty space deletes, drop on any handle keeps; arrowhead not persisted; edge aria-label set on React Flow's focusable wrapper; viewers' handles stay hidden.

## Open issues
- D-09a replaces the hook's `onConnect` with our own because the hook's id/type behaviour is undocumented; T-001 must confirm `add`/`replace` edge changes persist.
- D-09c depends on `defaultEdgeOptions` applying to controlled edges at render time (UNVERIFIED); fallback marker design is ready.
- Known limitation: no keyboard-only way to draw an edge (React Flow has none); NFR-006 partial for edge creation.
- Aligned with F06's drafted package (2026-10-22): registry in `components/canvas/node-types.ts` (F09 replaces `placeholder-edge.tsx`), schema already enforces handle ids/no self-loops (P-06-5) with a 500-char label bound (looser than the 100 UX cap), viewers have `elementsSelectable: false`, island is `flow-canvas.tsx`.
- `1b1a4f7` alone does not type-check (bisect note).
