# F01 — App Shell and Design System

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F00 (`cn()`, test harness, lint rules, error-page skeletons) |
| Depended on by | F02 (navbar right slot for `UserButton`, `(auth)` layout uses tokens), F04 (editor home + workspace chrome), F06 (React Flow stylesheet already imported), F16 (AI sidebar shell) |
| Product requirements | PRD-020 (chrome half: floating sidebars over a full-viewport canvas), NFR-006 |
| Status | see status.md |

## Purpose

F01 gives drawArc its visual language and the chrome every editor screen shares: the token set from `ui-context.md` wired into Tailwind v4, shadcn/ui primitives, the top navbar with its three slots, the floating project sidebar, a placeholder AI sidebar shell, the dialog pattern, and the accessibility and motion rules those components obey. It sits before auth so that F02's sign-in pages and `UserButton` land in a styled shell, and before any data so the chrome can be verified with no backend. Everything here is presentational: no fetches, no auth, no canvas.

## Problem statement and goals

- Problem: the scaffold has one unstyled page; the reference implementation's sidebar "peeked" when closed, pushed content, and the canvas later had to fight card-like wrappers. These are layout-rule failures that are cheapest to prevent in the shell itself.
- G-1: Every token in `ui-context.md` exists as a CSS variable and as the named Tailwind utility; no component under `app/` or `components/` (outside `components/ui/`) uses a hex literal or a raw palette class.
- G-2: Both sidebars float over content (`position: fixed`), never push it, and are fully invisible and non-focusable when closed (the reference bug).
- G-3: Chrome is keyboard-operable with visible focus, honours `prefers-reduced-motion`, and passes an automated a11y scan with zero serious/critical violations.
- G-4: `@xyflow/react/dist/style.css` is imported once, after `@import "tailwindcss"`, so F06 only adds the component.

## Scope

In scope:
- `app/globals.css`: `:root` tokens exactly as the ui-context table, `@theme inline` mapping to the listed utility names, shadcn variables bound to tokens, base `body` styles, React Flow stylesheet import (installs `@xyflow/react ~12.12`).
- `components.json` + shadcn/ui initial set: Button, Card, Dialog, Input, Textarea, Tabs, ScrollArea, Tooltip, DropdownMenu, Avatar, Badge (generated into `components/ui/`, never edited).
- `lucide-react`; icon size conventions.
- `app/layout.tsx`: metadata (`drawArc`), body token classes, `app/providers.tsx` (`TooltipProvider`).
- `components/editor/editor-navbar.tsx`, `sidebar-panel.tsx` (shared floating-panel primitive), `project-sidebar.tsx`, `editor-shell.tsx`, `app-dialog.tsx` (dialog pattern: `AppDialog`, `ConfirmDialog`), `empty-state.tsx`; `components/ai/ai-sidebar.tsx` (placeholder shell for F16).
- `app/editor/page.tsx` placeholder (static shell with the editor-home empty state) so the chrome is mountable and E2E-testable; F02 gates it, F04 replaces its content.
- Token styling of `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- Mobile scrim + tap-outside, Esc-to-close, focus management, reduced motion, contrast test, a11y scan.

Out of scope / non-goals:
- Any data or auth (F02/F03/F04). Workspace navbar contents (project name, Save status, Import, Share, AI toggle — F04/F13/F14/F12/F16). AI sidebar tabs, chat, specs (F16/F18). Canvas, palette pill, control bar, MiniMap (F06+). Concrete dialogs (New Project, Rename, Delete — F04). Light theme (never, D-016). Sidebar open-state persistence (not in M1). Storybook (never).

## User stories

- US-1: As a user, I want a consistent dark workspace with readable text and clear focus so that I can operate the editor by keyboard or mouse.
- US-2: As a user, I want to open the project sidebar over the canvas and close it completely so that it never steals canvas space or leaves a sliver on screen.
- US-3: As a mobile user, I want a scrim behind an open sidebar and tap-outside to close so that the sidebar does not trap me.
- US-4: As a user with reduced-motion preference, I want panels to appear without sliding so that the UI does not cause discomfort.
- US-5: As a developer, I want one `SidebarPanel` primitive and one dialog pattern so that F04/F12/F16 compose rather than re-implement.
- US-6 (abuse/regression): As a screen-reader or keyboard user I must not be able to reach controls inside a closed sidebar.

## Key decisions referenced

- D-016 (dark only, inherited tokens), NFR-006; `ui-context.md` layout rules are binding.
- PROPOSED D-F01-1: The React Flow stylesheet import lands in F01's `globals.css` (installing `@xyflow/react ~12.12` now, per D-023), so F06 adds only the component and the ordering rule is tested from day one. Alternative: import in F06 — rejected because the ordering rule is a stylesheet concern and F06 is already large.
- D-037 (applied): the AI accent utilities are `bg-ai` / `text-ai-text` (`--color-ai: var(--accent-ai)`, `--color-ai-text: var(--accent-ai-text)`), and shadcn's `--accent` is bound to `--bg-subtle` with `--accent-foreground: var(--text-primary)` so hover/active surfaces are neutral. D-F01-2 (the former `bg-accent` collision) is closed by D-037. PROPOSED D-F01-2a: one extra token `--accent-ai-foreground: #ffffff` (utility `text-ai-foreground`) for text on `bg-ai` buttons, because `--text-primary` on `--accent-ai` is only ≈ 4.3:1 while white is ≈ 4.9:1 (NFR-006); `ui-context.md` does not list this token yet (reported as a context defect in the Gate 4 audit).
- PROPOSED D-F01-3: One `SidebarPanel` primitive (side, open, onClose, label) implements fixed positioning, off-screen transform, `inert`/`aria-hidden`, visibility hand-off after the transition, Esc, focus return, scrim. Both sidebars compose it.
- PROPOSED D-F01-4: Sidebars are closed by default on every viewport (deterministic SSR, no hydration branch on media queries). F04 may revisit.
- PROPOSED D-F01-5: `app/editor/page.tsx` is created here as a static placeholder with the editor-home empty state. F02 wraps it in the auth gate; F04 owns its final content.
- PROPOSED D-F01-6: z-index scale — canvas 0, canvas pills 10, scrim 20, sidebars 30, navbar 40, Radix portals 50 (shadcn default).
- PROPOSED D-F01-7: `app/layout.tsx` keeps the owner's structure and font setup; only `metadata.title/description` change to drawArc copy, and body gains `bg-base text-copy-primary font-sans`.
- PROPOSED D-F01-8: Dialog pattern = `AppDialog` (title, description, body, footer) + `ConfirmDialog` (destructive variant, no input) built on shadcn `Dialog`; no concrete dialogs ship in F01.

## Reference material

- `context/ui-context.md` (tokens, layout patterns, copy, a11y), `context/code-standards.md` "Styling", `context/architecture-context.md` "Canvas architecture" (stylesheet ordering).
- Reference prompts (product intent only): `No_touch_ai/.../feature-specs/01-design-system.md`, `02-editor-chrome.md`, `20-ai-sidebar-shell.md` (header copy, floating behaviour); reference `context/context/ui-context.md`.
- Reference bug to prevent: `No_touch_ai/.../current-issues/current-issues-liveblocks-canvas.md` lines 25–33 — sidebars pushing content; left sidebar "partially visible or peeking out instead of sliding completely off-screen" (transform/overflow/shadow causes). Becomes EC-001/EC-002 and AC-010/AC-011.
- Research: `scratchpad/research/nextjs-testing.md` (Cache Components rules for the placeholder page; Playwright 1.64; `instant()`), checked 2026-10-22.
