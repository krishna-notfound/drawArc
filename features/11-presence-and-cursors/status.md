# F11 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*`, `research/liveblocks.md` §1/§4/§8 (checked 2026-10-22), and the reference prompt `19-presence-avatars-cursors.md`.
- 2026-10-22 — Gate 4 audit fixes applied (T-007 FR link; `presenceSlot` contract settled with F04). See `features/AUDIT-2026-10-22.md`.

## Evidence
- (none yet) — T-001 findings on `CursorsCursorProps`, pane-leave clearing, and zoom scaling go here.

## Open issues
- `CursorsCursorProps` shape is UNVERIFIED; if the custom-component contract cannot supply name/colour/`thinking`, the `cursors-fallback.tsx` path (P-11-1) is used — functionally equivalent, but the owner should know which file ships.
- P-11-2 (clear cursor on tab hide/blur) and P-11-3 (dedupe by user id, "(n tabs)") are small UX decisions the owner may want to confirm.
- Resolved at Gate 4: F04's `Workspace` renders `presenceSlot ?? <UserMenu/>` (the slot *replaces* the default user button), so `PresenceStack` — which contains the `UserButton` — is the slot content without duplication (F04 FR-013/AC-020).
- Mobile stack limit of 3 avatars (< 768 px) is a PROPOSED detail not in `ui-context.md`.
