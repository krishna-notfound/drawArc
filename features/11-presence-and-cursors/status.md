# F11 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and verified (combined with F07); PR open |
| Spec approved | 2026-10-24, owner (incl. its local decisions) |
| Implementation authorized | 2026-10-24, owner — parallel round 4, own worktree |
| Last verified | 2026-10-24, `c74c004`; combined round-4 check at `42becbf` |

## History
- 2026-10-22 — drafted by planning session (spec writer), from `context/*`, `research/liveblocks.md` §1/§4/§8 (checked 2026-10-22), and the reference prompt `19-presence-avatars-cursors.md`.
- 2026-10-22 — Gate 4 audit fixes applied (T-007 FR link; `presenceSlot` contract settled with F04). See `features/AUDIT-2026-10-22.md`.

## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `49118ca` Liveblocks styles + avatar-stack logic · `8ac4402` live cursors with name badges · `d4c8288` avatar stack top-right · `699640d` own user id from the room token · `c74c004` two-user presence e2e.

| Check | Result |
|---|---|
| Agent gate | check 414/414, build OK, e2e 40/40, audit 0 |
| Round-4 combined (main session) | check 428/428, build OK, e2e 44/45 (1 known cold-start flake, not F11) |

AC mapping (agent): unit 001, 008, 009, 013, 017; e2e 003, 005, 006, 010 (no-others half), 012, 014, 016; inspection 002, 004, 007, 011. **Not met: AC-015** — Liveblocks' cursor animation is a JS spring that keeps animating under reduced motion; only the spinner honours it.

Rulings: avatars portal from inside the room into the navbar presence slot (`PresenceStack` target + `PresenceOthers`); own id from `useSelf`; tab-hidden handling merged into `LiveCursors`; viewer presence checked with a throwaway spec only.

## Open issues
- `CursorsCursorProps` shape is UNVERIFIED; if the custom-component contract cannot supply name/colour/`thinking`, the `cursors-fallback.tsx` path (P-11-1) is used — functionally equivalent, but the owner should know which file ships.
- P-11-2 (clear cursor on tab hide/blur) and P-11-3 (dedupe by user id, "(n tabs)") are small UX decisions the owner may want to confirm.
- Resolved at Gate 4: F04's `Workspace` renders `presenceSlot ?? <UserMenu/>` (the slot *replaces* the default user button), so `PresenceStack` — which contains the `UserButton` — is the slot content without duplication (F04 FR-013/AC-020).
- Mobile stack limit of 3 avatars (< 768 px) is a PROPOSED detail not in `ui-context.md`.
- AC-015 (reduced motion for cursors) not met — options: replace `<Cursors/>` with a custom renderer that skips the spring when reduced motion is set, or accept.
- Liveblocks badge overlaps the MiniMap — owner to choose a fix (move MiniMap, or hide the badge if the plan allows).
