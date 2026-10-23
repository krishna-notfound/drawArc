# F11 — Test Plan

Layers per `context/testing-strategy.md`. L3 uses the F05 `twoUsers` fixture (A owner, B editor or viewer as stated) against the Liveblocks dev server with `NEXT_PUBLIC_E2E_HOOKS=1` (exposes `window.__rf` for `flowToScreenPosition`).

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/deps/stylesheet-order.test.ts` | read `app/globals.css` | compute import indices | strictly increasing in the required order |
| TC-002 | AC-002 | L1 | `tests/unit/components/live-cursors.test.tsx` | mock `@liveblocks/react-flow` `Cursors`; mock `FlowCanvas` capturing children | render | `Cursors` once with `components.Cursor === CanvasCursor`; present among children |
| TC-003 | AC-003 | L3 | `tests/e2e/presence.spec.ts` | A, B editors; both at zoom 1 | B `mouse.move` to pane point; A pans (−200,0), zooms 0.5 via `window.__rf.setViewport` | one `remote-cursor[data-user-id=B]`; position ≈ `flowToScreenPosition` ±4 px after each change; size constant; log move→render latency over 10 moves, p95 < 500 ms |
| TC-004 | AC-004 | L1 | `tests/unit/components/canvas-cursor.test.tsx` | render with fake other, `thinking` false/true | inspect styles/text | colours, text, `aria-hidden`; spinner with title when thinking |
| TC-005 | AC-005 | L3 | `tests/e2e/presence.spec.ts` | as TC-003 | A moves own pointer | A has no cursor for A; B has one for A |
| TC-006 | AC-006 | L3 | `tests/e2e/presence.spec.ts` | B cursor visible to A | B moves pointer onto the open left sidebar | A's cursor for B gone ≤ 1 s |
| TC-007 | AC-007 | L1 | `tests/unit/components/presence-hygiene.test.tsx` | mock `useUpdateMyPresence` | dispatch `visibilitychange` hidden/visible, `blur` | `{cursor:null}` ×2; not on visible |
| TC-008 | AC-008 | L1 | `tests/unit/components/presence-stack.test.tsx` | mock `useOthers` with 7 others | render `max=5`; open chip tooltip | 5 avatars in order; "+2"; tooltip lists u6, u7 |
| TC-009 | AC-009 | L1 | same | two connections for `u1`, plus `me` | render | one avatar; "(2 tabs)"; no `me`; aria-label singular form |
| TC-010 | AC-013 | L1 | same | 3 others | read root attributes | `role="group"`, exact aria-label |
| TC-011 | AC-011 | L1 | `tests/unit/components/presence-avatar.test.tsx` | props variants; read `next.config.ts` | render; fire `error` on img | img alt + outline; initials; "?"/"Someone"; fallback on error; remotePatterns only `img.clerk.com` |
| TC-012 | AC-010 | L3 | `tests/e2e/presence.spec.ts` | A alone; then B seeded VIEWER joins | inspect A's stack before/after | only `UserButton`, no divider; then divider + 1 avatar |
| TC-013 | AC-012 | L3 | `tests/e2e/presence.spec.ts` | 2 others present | keyboard Tab from the pill; Enter on an avatar | focus order; tooltips on focus; URL unchanged; badges `aria-hidden` |
| TC-014 | AC-014 | L3 | `tests/e2e/presence.spec.ts` | A alone | open B; close B's context | B appears ≤ 1 s; disappears ≤ 7 s; no console errors |
| TC-015 | AC-015 | L3 | `tests/e2e/presence.spec.ts` | `page.emulateMedia({ reducedMotion: 'reduce' })` on A | B moves; inspect computed styles | `transition-duration: 0s`, no `animate-spin`; without emulation ≤ 50 ms |
| TC-016 | AC-016 | L3 | `tests/e2e/presence.spec.ts` | B present | measure stack box; goto `/editor` | top-right placement; `UserButton` last; no stack on home; home `UserButton` present |
| TC-017 | AC-017 | L1 | `tests/unit/lib/initials.test.ts` | table of names | call | expected initials |

## Collaboration / concurrency cases (mandatory section)

Presence is read-only in this feature; the applicable strategy cases are the join/leave timing (TC-014) and the lost-connection reset (EC-007, observed in TC-014 when B's context closes: A's stack empties within `lostConnectionTimeout`). Storage concurrency cases are owned by F06/F10. "Owner removes B" (F05 TC-016) is extended by one assertion here: after KICK, B's avatar leaves A's stack within 7 s (added to F05's `kick.spec.ts` as a follow-up assertion, referenced as F11/TC-014b).

## AUTHZ-MATRIX

No new endpoints. Names/avatars are resolved through F05 `GET /api/users/resolve` (F05 TC-009 covers its scoping).

## Not tested automatically (and why)

- Visual quality of the cursor glyph, badge legibility at zoom 0.1/4, and avatar overlap: manual screenshots at 1280×800 and 390×844 in `status.md`.
- Behaviour with > 10 participants (Team plan only) beyond the unit-mocked 7-other case (TC-008): plan limit (R-02).
- Exact 50 ms interpolation feel versus 100 ms: subjective; the computed `transition-duration` is asserted (TC-015), the choice itself is P-05-1.
- `thinking: true` end-to-end: no M1 writer exists; unit-tested rendering (TC-004) and re-verified by F17's E2E.
