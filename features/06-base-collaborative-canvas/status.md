# F06 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*`, `research/react-flow.md` §1/§8/§12/§13 and `research/liveblocks.md` §1 (checked 2026-10-22), and the reference `current-issues` bugs.
- 2026-10-22 — Gate 4 audit fixes applied (FR-009 exemptions for F10/F14 `fitView`, `@xyflow/react` owned by F01, FR links on collab ACs, `NEXT_PUBLIC_E2E_HOOKS` env registration). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet)

## Open issues
- Blocked on F05 T-001 spike results (c) viewport not synced and (d) `onNodesChange` add path; `DevAddNode` and F07's drop handler depend on (d).
- P-06-6 schema freeze: on approval, `context/domain-model.md` "Canvas schema v1" status changes from PROPOSED to frozen; owner to confirm the stricter id/handle/integrity rules (P-06-5) since templates (F14) and the agent (F17) must produce ULID-suffixed ids.
- P-06-2 relies on the inference that the `fitView` prop defers until the first measured node (the reference bug); the design avoids the prop regardless, so no fallback is needed, but the inference should be recorded VERIFIED/UNVERIFIED during T-006.
- `zoomOnScroll={false}` + `zoomActivationKeyCode` (⌘/Ctrl+wheel) matches `ui-context.md`; if trackpad pinch proves unreliable on Windows during T-007, record and propose a change rather than silently re-enabling wheel zoom.
- `DevAddNode` must be deleted by F07 (tracked in F07's plan); leaving it in would ship a test affordance to production builds with the flag set.
