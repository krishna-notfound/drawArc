# F09 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from F07 contracts, `research/react-flow.md` §2–§3, §14, `research/liveblocks.md` §1, §3, reference prompt 16 and `current-issues-workspace-implementation.md` §3.
- 2026-10-22 — Gate 4 audit fixes applied (AC-017 single layer, FR links on AC-020/021, TC-011/TC-023 AC links, Manual TC-024, schema label bound 500 consistent, `HandleId` owned by F06). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 spike output, `npm run check` logs, AC-022 screenshot.

## Open issues
- D-09a replaces the hook's `onConnect` with our own because the hook's id/type behaviour is undocumented; T-001 must confirm `add`/`replace` edge changes persist.
- D-09c depends on `defaultEdgeOptions` applying to controlled edges at render time (UNVERIFIED); fallback marker design is ready.
- Known limitation: no keyboard-only way to draw an edge (React Flow has none); NFR-006 partial for edge creation.
- Aligned with F06's drafted package (2026-10-22): registry in `components/canvas/node-types.ts` (F09 replaces `placeholder-edge.tsx`), schema already enforces handle ids/no self-loops (P-06-5) with a 500-char label bound (looser than the 100 UX cap), viewers have `elementsSelectable: false`, island is `flow-canvas.tsx`.
