# F11 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `app/globals.css` shall import `@liveblocks/react-ui/styles.css` and `@liveblocks/react-flow/styles.css` after `@xyflow/react/dist/style.css`; a unit test shall assert the order. | must | research §1 | AC-001 |
| FR-002 | `components/canvas/live-cursors.tsx` shall render `<Cursors components={{ Cursor: CanvasCursor }} />` as a child of `<ReactFlow>` (via the F06 `children` slot) so cursors are positioned in flow coordinates and move with pan/zoom. | must | PRD-031, P-11-1 | AC-002, AC-003 |
| FR-003 | `CanvasCursor` shall draw a pointer glyph filled with the participant's `info.color`, a badge with `info.name` on the same colour, and a 12 px spinner inside the badge when `presence.thinking === true`; it shall never render for the current connection. | must | ui-context "Cursors", PRD-052 (M2 hook) | AC-004, AC-005 |
| FR-004 | The current user's `presence.cursor` shall be set to flow coordinates on pointer movement over the pane and to `null` on pointer leave, on `visibilitychange` → hidden, and on window `blur`. | must | P-11-2 | AC-006, AC-007 |
| FR-005 | `components/canvas/presence-stack.tsx` shall render, from `useOthers`, one avatar per distinct `id` excluding `currentUser.id`, ordered by first seen, at most 5 avatars followed by a "+N" chip when more exist; it shall include viewers. | must | PRD-031, P-11-3 | AC-008, AC-009, AC-010 |
| FR-006 | Each avatar shall show `info.avatar` via `next/image` when present, else initials (first letters of up to two words of `info.name`, uppercase) on a `bg-elevated` disc; 32 px, overlapping by 8 px, `ring-2` in `--bg-base` plus a 2 px outline in `info.color`. | must | ui-context, P-11-4 | AC-011 |
| FR-007 | A vertical divider (`border-surface-border`) shall separate the avatar stack from the Clerk `UserButton` only when at least one other participant is present; with none, only the `UserButton` renders. | must | reference intent, ui-context | AC-010 |
| FR-008 | Avatars and the "+N" chip shall be non-interactive (no click handlers, no navigation) but keyboard-focusable (`tabIndex=0`) with a tooltip: avatar → name (plus "(n tabs)" when deduped); chip → the remaining names, one per line; the stack root shall have `role="group"` and `aria-label="{n} other people here: {names}"`. | must | NFR-006 | AC-012, AC-013 |
| FR-009 | Avatar images shall have `alt={info.name}`; initials discs `aria-label={info.name}`; cursor badges `aria-hidden` (decorative; names are announced via the stack). | must | NFR-006 | AC-012 |
| FR-010 | A participant who joins shall appear in every other participant's stack within 1 s; one who leaves (tab closed) shall disappear within `lostConnectionTimeout` + 2 s (≤ 7 s). | must | PRD-031, F05 FR-009 | AC-014 |
| FR-011 | Cursor and avatar animations shall be disabled under `prefers-reduced-motion`; cursor position updates shall otherwise be interpolated over ≤ 50 ms (matching F05 `throttle`). | should | NFR-006, P-05-1 | AC-015 |
| FR-012 | The stack shall be mounted in the workspace top-right slot (F04) over the canvas, to the right of the connection-status pill and viewer badge; the editor-home navbar shall be unchanged. | must | ui-context "Layout patterns" | AC-016 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-003 | Pointer move → remote cursor render measured ≤ 500 ms p95 in TC-003 (10 samples). |
| NFR-006 | Alt text, aria labels, keyboard tooltips, reduced motion, colour never the sole carrier (names on badges and tooltips). |
| NFR-007 | `useOthers` selectors typed by the global `Liveblocks` interface; `CursorsCursorProps` imported from the package. |
| NFR-008 | No new env or secrets. |
| NFR-010 | No new dependencies (lucide `Loader2` for the spinner, shadcn `Tooltip` from F01). |

## UX and interaction behaviour

| Element | Behaviour |
|---|---|
| Cursor glyph | 16 px arrow SVG, fill `info.color`, 1 px `--bg-base` stroke; badge 4 px to the right/below: `rounded-xl`, 11 px Geist Sans, background `info.color`, text `--bg-base` for contrast (all seven `USER_COLORS` are light; verified ≥ 4.5:1 in F06 palette test against `#080809`). |
| Thinking | `Loader2` 12 px `animate-spin` left of the name; `title="Thinking…"`. No animation under reduced motion (static icon). |
| Hide self | `<Cursors/>` renders others only; the stack filters `id === currentUser.id`. |
| Stack | Top-right, `fixed`, 16 px inset, above canvas z-index (below dialogs). Order: `[ConnectionStatus pill][View only badge] … [avatars][+N][divider][UserButton]` with 8 px gaps; avatars overlap −8 px, later ones on top. |
| Tooltip | shadcn `Tooltip`, opens on hover and focus, `side="bottom"`. Chip tooltip lists names (max 10, then "and N more"). |
| Mobile (< 768 px) | Stack shows at most 3 avatars then "+N"; cursors unchanged. |
| Copy | aria-label "3 other people here: Ada Lovelace, Grace Hopper, Linus"; tooltip "(2 tabs)" suffix for deduped users. |

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Participant with `info.avatar` null or image fails to load | Initials disc rendered (image `onError` swaps to initials) | AC-011 |
| EC-002 | Same user in two tabs | One avatar with "(2 tabs)"; two cursors drawn (per connection) | AC-009 |
| EC-003 | 12 others present (Team plan) | 5 avatars + "+7"; tooltip lists names | AC-008 |
| EC-004 | Participant's name empty | Name falls back to email local-part (set in F05 `userInfo`), initials from it; never an empty badge | AC-011 |
| EC-005 | Pointer leaves canvas to a floating sidebar | Cursor `null` for others (pane leave) | AC-006 |
| EC-006 | Tab hidden / window blurred | Cursor `null` within one throttle tick | AC-007 |
| EC-007 | Connection lost (> 5 s) | Others' list resets to empty (Liveblocks behaviour) → stack shows only `UserButton`; restored → repopulates | AC-014 |
| EC-008 | Zoom 0.1 or 4 | Cursor glyph and badge keep screen size (not scaled with the viewport); position stays correct | AC-003 |
| EC-009 | `info` missing for a connection (resolveUsers failed) | Fallback name "Someone", colour `USER_COLORS[0]`, initials "?" | AC-011 |
| EC-010 | Viewer present | Shown identically to editors (no role in presence) | AC-010 |
| EC-011 | Reduced-motion user | No cursor interpolation/spinner animation | AC-015 |
