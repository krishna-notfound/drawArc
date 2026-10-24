# F06 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #8 (2026-10-24); canvas schema v1 frozen |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 3, own worktree |
| Last verified | 2026-10-24, `64af116`; combined round-3 check at `d038dba` |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*`, `research/react-flow.md` §1/§8/§12/§13 and `research/liveblocks.md` §1 (checked 2026-10-22), and the reference `current-issues` bugs.
- 2026-10-22 — Gate 4 audit fixes applied (FR-009 exemptions for F10/F14 `fitView`, `@xyflow/react` owned by F01, FR links on collab ACs, `NEXT_PUBLIC_E2E_HOOKS` env registration). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `14f6762` schema v1 types, Zod, migrate, serialisers · `1a6a5a3` canvas mounted inside the project room · `f2a00b1` two-user e2e, workspace specs on the real canvas · `64af116` dev-hook flag build-time constant.

| Check | Result |
|---|---|
| Agent gate | check 374/374, build OK, e2e 35 passed, audit 0 |
| Round-3 combined (F06 merged into F12, main session) | check 404/404, build OK, e2e 38/39 — 1 load flake in F12 downgrade test (sharing spec 7/7 alone, twice) |
| GitHub CI | PR #8 pass |

AC mapping (agent): unit 002–008, 009–011 (mocked), 015, 019; collab e2e 012, 014, 020, 016 (partly, viewer spec); 001 pin test + inspection; 017/018 inspection + e2e; not automated (lean policy): 013, 021–024, fitView grep guard.

Rulings: viewers get an empty read-only canvas and no change handlers until an editor initialises the room (the hook writes on mount, which crashed viewers); the canvas leaves the room while its own project delete is pending (the owner was being kicked to the access-denied page); inline id generator instead of ulid; mount via the page's canvas slot (workspace.tsx untouched); dev Add-test-node button bottom-centre, compiled out by a build-time flag (F07 removes it).

## Open issues
- Blocked on F05 T-001 spike results (c) viewport not synced and (d) `onNodesChange` add path; `DevAddNode` and F07's drop handler depend on (d).
- P-06-6 schema freeze: on approval, `context/domain-model.md` "Canvas schema v1" status changes from PROPOSED to frozen; owner to confirm the stricter id/handle/integrity rules (P-06-5) since templates (F14) and the agent (F17) must produce ULID-suffixed ids.
- P-06-2 relies on the inference that the `fitView` prop defers until the first measured node (the reference bug); the design avoids the prop regardless, so no fallback is needed, but the inference should be recorded VERIFIED/UNVERIFIED during T-006.
- `zoomOnScroll={false}` + `zoomActivationKeyCode` (⌘/Ctrl+wheel) matches `ui-context.md`; if trackpad pinch proves unreliable on Windows during T-007, record and propose a change rather than silently re-enabling wheel zoom.
- `DevAddNode` must be deleted by F07 (tracked in F07's plan); leaving it in would ship a test affordance to production builds with the flag set.
- Workspace e2e specs leave rooms in the Liveblocks Development project (cleanup task later).
- Liveblocks badge overlaps the MiniMap.
- F04 duplicate-id issue (hidden previous pages) still open.
