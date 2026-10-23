# F11 — Implementation Plan (outline)

**Dependencies to install:** none (`@liveblocks/react-flow`, `@liveblocks/react-ui` from F05; `lucide-react`, shadcn `Tooltip`/`Avatar` from F01; `@clerk/nextjs` `UserButton` from F02).

**Environment variables added:** none.

**Migrations:** none.

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | Half-day verification: render `<Cursors components={{ Cursor }}/>` in the dev app with two tabs and log the props the custom `Cursor` receives; confirm pane-leave clears the cursor and whether the glyph scales with zoom. Record VERIFIED/UNVERIFIED in `status.md`; choose `canvas-cursor.tsx` on `<Cursors/>` or `cursors-fallback.tsx` (`useOthersMapped` + `<ViewportPortal>`). | FR-002–FR-004 | `status.md` | Decision recorded; owner informed if fallback chosen |
| T-002 | Stylesheet imports in `app/globals.css` (order per FR-001) + order test; `lib/initials.ts` + unit test. | FR-001, FR-006 | `app/globals.css`, `tests/unit/deps/stylesheet-order.test.ts`, `lib/initials.ts`, `tests/unit/lib/initials.test.ts` | AC-001, AC-017 |
| T-003 | `canvas-cursor.tsx` (glyph, badge, spinner, `aria-hidden`, reduced-motion CSS via `motion-safe:`/`motion-reduce:` utilities, `data-testid="remote-cursor"`, `data-user-id`), `live-cursors.tsx` (wrapper), `presence-hygiene.tsx` (hide/blur → `cursor: null`). Unit tests. | FR-002, FR-003, FR-004, FR-011 | `components/canvas/canvas-cursor.tsx`, `components/canvas/live-cursors.tsx`, `components/canvas/presence-hygiene.tsx`, `tests/unit/components/{canvas-cursor,live-cursors,presence-hygiene}.test.tsx` | AC-002, AC-004, AC-007 |
| T-004 | `presence-avatar.tsx` (image/initials, outline colour, error fallback, alt/aria) and `presence-stack.tsx` (selector + dedupe, max 5 / 3 under md, "+N" chip, tooltips, divider rule, `role="group"` label, `UserButton` last, `data-testid`s). Unit tests incl. `next.config.ts` remotePatterns assertion. | FR-005–FR-009 | `components/canvas/presence-avatar.tsx`, `components/canvas/presence-stack.tsx`, `tests/unit/components/{presence-avatar,presence-stack}.test.tsx` | AC-008, AC-009, AC-011, AC-013 |
| T-005 | Mount: add `<LiveCursors/>` and `<PresenceHygiene/>` as `FlowCanvas` children and `<PresenceStack currentUserId/>` in the workspace top-right slot (moving `UserButton` inside it); style the Clerk avatar box to 32 px via `appearance` tokens; confirm editor-home navbar untouched. | FR-012 | `components/editor/workspace.tsx` | Manual check + AC-016 in T-006 |
| T-006 | E2E `tests/e2e/presence.spec.ts` on the F05 `twoUsers` fixture: cursor visible/positioned under pan+zoom with p95 latency log, self never drawn, pane-leave clears, join/leave timing, viewer shown, divider rule, a11y tab order + tooltips, reduced-motion emulation, layout slot, editor-home unchanged. | FR-002–FR-012 | `tests/e2e/presence.spec.ts` | AC-003, AC-005, AC-006, AC-010, AC-012, AC-014, AC-015, AC-016 |
| T-007 | Docs: P-11-1…4 to `context/decision-log.md`; `status.md` evidence with screenshots at 1280×800 and 390×844 (visual record for FR-006/FR-012). | FR-006, FR-012 (evidence) | `context/decision-log.md`, `status.md` | Owner review at Gate 5 |

Order: T-001 → T-002 → T-003 → T-004 (T-003/T-004 parallelisable) → T-005 → T-006 → T-007. Each task ends with `npm run check` green; T-006 with `npm run e2e`.

This is an outline; the step-by-step plan is produced at Gate 6 with `superpowers:writing-plans` into `docs/superpowers/plans/` and must trace back to these task IDs.
