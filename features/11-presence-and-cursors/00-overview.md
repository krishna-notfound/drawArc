# F11 — Presence and Cursors

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F06 (`FlowCanvas` children slot inside `<ReactFlow>`), F05 (Presence/UserMeta types, `throttle`, `lostConnectionTimeout`, `resolveUsers`, `userColor`), F04 (workspace top-right slot, Clerk `UserButton`) |
| Depended on by | F16 (AI sidebar reuses the avatar stack and the `thinking` spinner), F17 (agent presence rendered by the same cursor component) |
| Product requirements | PRD-031 |
| Status | see status.md |

## Purpose

F11 makes collaborators visible: every other participant's pointer is drawn on the canvas in flow coordinates with a name badge in their assigned colour, and an avatar stack in the top-right corner shows who is in the room. It sits after F06 because cursors must live inside `<ReactFlow>` to pan and zoom with the diagram, and before F16/F17 because the agent's presence (`thinking`) is rendered through the same components.

## Problem statement and goals

- Problem: without cursors and an avatar stack, collaboration is invisible — users cannot tell who is editing, where, or whether anyone else is present (M1 acceptance run step 3 requires seeing the other's cursor).
- G-1: B's cursor appears on A's canvas within 500 ms of B's pointer move and tracks pan/zoom (flow coordinates).
- G-2: The avatar stack shows every other participant (editors and viewers), never the current user, updating on join immediately and on leave within `lostConnectionTimeout` (5 s).
- G-3: Names, colours, and avatars are consistent with F05's `userInfo` (same `userColor`), readable on the dark canvas, and accessible (alt text, tooltips, keyboard focus).
- G-4: Presence traffic stays within F05's `throttle: 50` ms budget; no extra React state mirrors `others`.

## Scope

In scope:
- `<Cursors/>` from `@liveblocks/react-flow` rendered as a child of `<ReactFlow>` with a custom `Cursor` component; `@liveblocks/react-ui/styles.css` and `@liveblocks/react-flow/styles.css` imported in `app/globals.css` after the React Flow stylesheet.
- `components/canvas/canvas-cursor.tsx`: pointer glyph + name badge in the user's colour; spinner when `presence.thinking` (M2 hook; rendered now, driven later).
- Presence hygiene: cursor is `null` when the pointer leaves the pane, when the tab is hidden, and on blur.
- `components/canvas/presence-stack.tsx`: avatar stack (others only, deduped by user id, up to 5 + "+N"), "Who's here" tooltips, divider only when ≥ 1 other, then Clerk `UserButton`; mounted in the workspace top-right slot over the canvas.
- Accessibility: alt text, `aria-label`s, keyboard-reachable tooltips, reduced-motion.
- Unit tests for the components; E2E for cursor visibility and stack join/leave.

Out of scope / non-goals:
- Setting `thinking: true` (F17). Follow/"jump to user" (never in M1–M3). Showing presence in the editor-home navbar (F04 owns that navbar; nothing changes there). Changing node/edge behaviour. Comments/mentions (never).

## User stories

- US-1: As an editor, I want to see my collaborator's cursor with their name so that I know where they are working.
- US-2: As any member, I want an avatar stack of who is here so that I know whether I am alone.
- US-3: As a viewer, I want my presence shown like everyone else's so that editors know I am watching.
- US-4: As a user with a screen reader, I want avatars and the stack announced by name.
- US-5 (abuse/edge): As a user with two tabs open, I must appear once in the stack and my own cursor must never be drawn to me.

## Key decisions referenced

- D-012 (Storage/Presence via Liveblocks), F05 P-05-1 (`throttle: 50`), F05 P-05-6 (`USER_COLORS`), D-016 (dark theme).
- PROPOSED by this feature:
  - **P-11-1** Use `<Cursors/>` from `@liveblocks/react-flow` (which sets/clears `presence.cursor` and renders in flow coordinates) rather than a hand-rolled `onMouseMove` overlay as in the reference prompt. Rationale: pan/zoom-aware rendering and throttled presence updates come for free; one less place to get coordinate maths wrong. Fallback if the custom-component prop contract proves unusable (see UNVERIFIED): `components/canvas/cursors-fallback.tsx` using `useOthersMapped` + React Flow `<ViewportPortal>` + `onPaneMouseMove` → `screenToFlowPosition`.
  - **P-11-2** Clear `cursor` to `null` on `visibilitychange` (hidden) and window `blur`, in addition to pointer-leave. Rationale: otherwise a backgrounded tab leaves a frozen cursor on everyone's canvas for the whole session.
  - **P-11-3** Dedupe the avatar stack by user id (not `connectionId`); the tooltip of a deduped avatar shows "(2 tabs)". Rationale: the same person with two tabs is one collaborator; cursors, however, are per connection and both are drawn.
  - **P-11-4** Avatar size 32 px (`h-8 w-8`), overlap −8 px, `ring-2` in `--bg-base` plus a 2 px outline in the user's colour. Rationale: matches the Clerk `UserButton` avatar box we style to 32 px; the colour outline ties avatar to cursor badge.

## Reference material

- `context/ui-context.md` "Cursors", "Layout patterns" (top-right stack), "Accessibility expectations"; `context/domain-model.md` Presence/UserMeta; `context/data-ownership.md` (Presence is ephemeral, never mirrored).
- Research `research/liveblocks.md` §1 (`Cursors` component, `presenceKey`, `components.Cursor`, styles), §4 (presence hooks, `throttle` 16–1000, `lostConnectionTimeout` resets `others`, `resolveUsers`), §8 (lost-connection timing) — checked 2026-10-22.
- Reference prompt `No_touch_ai/…/feature-specs/19-presence-avatars-cursors.md` (intent: top-right stack, exclude self, 5 + "+N", initials, ring, divider rule, UserButton kept, non-interactive). Its manual `onMouseMove` broadcasting is superseded by P-11-1.
- Reference bug `current-issues-workspace-implementation.md` §6 (avatar image host): `img.clerk.com` is already in `images.remotePatterns` (F01/F02, code-standards rule 9) — F11 asserts it in a unit test rather than re-adding it.
