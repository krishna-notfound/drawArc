# F16 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer). Transport decision F16-D1 recorded as PROPOSED with the Storage fallback as the tested design; Liveblocks Feeds marked UNVERIFIED pending T-001.
- 2026-10-22 — Gate 4 audit fixes applied (D-037 token names, F01 shell path, `RoomEvent` not restated, ROLE_CHANGED wording, FR links). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 outcome, `npm run check` output, L3 run against preview URL, screenshots of the sidebar states.

## Open issues
- T-001: verify Liveblocks Feeds API; decide F16-D1 (Feeds vs Storage `chat`/`aiStatus`).
- F16-D2 (viewers cannot post) needs owner confirmation — PRD-055 says "viewers see status only", consistent, but the reference prompt 25 allowed all room users to send.
- F16-D3: reference green `#62C073` mapped to existing tokens (`bg-ai`/`text-ai-foreground` button and active tab, `text-ai-text` assistant bubbles, `text-success` indicator — D-037 names) — confirm.
- R-11: client-supplied `senderId` (impersonation within a project) accepted for M2 — confirm.
- Sender names use Liveblocks `useUser(senderId)` over F05's `resolveUsers` (`GET /api/users/resolve`); the hook's behaviour for arbitrary ids is UNVERIFIED — fallback is presence `info.name`, then "Member" (T-005).
- The AI sidebar shell (`components/ai/ai-sidebar.tsx`, open state in F01's `useEditorChrome`) is owned by F01 and mounted by F04; F16 fills its body (Gate 4 alignment). If the shell changes shape before F16 starts, FR-001/FR-002 ACs are re-pointed, not duplicated.
