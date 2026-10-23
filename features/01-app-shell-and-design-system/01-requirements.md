# F01 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority (must/should) | Source (PRD/US) | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `app/globals.css` shall declare on `:root` every CSS variable in the ui-context theme table with exactly the listed value (`--bg-base: #080809` … `--state-warning: #fbbf24`). | must | ui-context "Theme", D-016 | AC-001 |
| FR-002 | `app/globals.css` shall map tokens in `@theme inline` so that exactly these utilities exist: `bg-base`, `bg-surface`, `bg-elevated`, `bg-subtle`, `border-surface-border`, `border-surface-subtle`, `text-copy-primary`, `text-copy-secondary`, `text-copy-muted`, `text-copy-faint`, `text-brand`/`bg-brand`, `bg-brand-dim`, `bg-ai`, `text-ai-text`, `text-ai-foreground` (D-F01-2a), `text-error`, `text-success`, `text-warning`, plus `font-sans`/`font-mono` bound to the Geist variables; the utility names `bg-accent`/`text-accent-text` are reserved for shadcn's own `accent` surface and never used for the AI accent (D-037). | must | ui-context "Theme", D-037 | AC-002, AC-002b |
| FR-003 | `app/globals.css` shall import `@import "tailwindcss"` first and `@import "@xyflow/react/dist/style.css"` immediately after it, before any `@theme`/`:root` block; `@xyflow/react` shall be installed at `~12.12`. | must | architecture "Canvas architecture", D-F01-1, D-023 | AC-003 |
| FR-004 | shadcn/ui shall be initialised (`components.json`, `tailwind.css = app/globals.css`, aliases `@/components`, `@/lib/utils`) and these components generated into `components/ui/`: Button, Card, Dialog, Input, Textarea, Tabs, ScrollArea, Tooltip, DropdownMenu, Avatar, Badge. Generated files shall not be edited. | must | ui-context "Component library" | AC-004, AC-005 |
| FR-005 | shadcn's CSS variables (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, and their `-foreground` pairs) shall be bound to drawArc tokens via `var(--…)` with no hex literal in that block. | must | ui-context "no hardcoded colours" | AC-006 |
| FR-006 | `lucide-react` shall be installed; all icons used by F01 components shall use the size classes `h-4 w-4` (inline), `h-5 w-5` (buttons), `h-8 w-8` (empty-state). | must | ui-context "Icons" | AC-007 |
| FR-007 | `app/layout.tsx` shall set `metadata.title = { default: 'drawArc', template: '%s · drawArc' }`, `metadata.description = 'Real-time collaborative system-design canvas.'`, keep the Geist font variables on `<html>`, add `bg-base text-copy-primary font-sans` to `<body>`, and render `app/providers.tsx` (`TooltipProvider`) around `children`. | must | ui-context "Copy", "Typography" | AC-008 |
| FR-008 | `EditorNavbar` shall be a fixed-height (`h-14`) top bar with left, center, right slots; the left slot contains the sidebar toggle (`PanelLeftOpen` when closed, `PanelLeftClose` when open) with `aria-label` "Open projects sidebar"/"Close projects sidebar", `aria-expanded`, `aria-controls="project-sidebar"`, and a tooltip; center defaults to the text "drawArc". | must | ui-context "Layout patterns", reference 02-editor-chrome | AC-009 |
| FR-009 | `SidebarPanel` shall render `position: fixed` below the navbar, float over content (never changes the layout of siblings), slide from its side, and when closed be entirely outside the viewport (`translateX(-100%)` / `translateX(100%)`), `visibility: hidden` after the transition, `aria-hidden="true"`, and `inert`; it shall carry no box-shadow while closed. | must | ui-context "Sidebars", reference bug, US-2, US-6 | AC-010, AC-011, AC-012 |
| FR-010 | `SidebarPanel` shall close on `Escape` when focus is inside it, move focus to its close button on open, return focus to the element that opened it on close, and on viewports `< 768px` render a scrim behind it that closes it on click/tap. | must | NFR-006, ui-context "Mobile", US-3 | AC-013, AC-014, AC-015 |
| FR-011 | Panel and scrim transitions shall be disabled under `prefers-reduced-motion: reduce` (`motion-reduce:transition-none`); open/closed end states are identical with and without motion. | must | ui-context "Reduced motion", US-4 | AC-016 |
| FR-012 | `ProjectSidebar` shall compose `SidebarPanel` (`side="left"`, `id="project-sidebar"`, label "Projects") with a header "Projects" + close button, shadcn `Tabs` "My Projects" (default) and "Shared with me", empty states (My Projects: "No projects yet" / "Create your first project to get started."; Shared with me: "Nothing shared with you yet" / "Projects others share with you will appear here."), and a full-width bottom button "New Project" with a `Plus` icon, disabled when no `onNewProject` handler is supplied. F04 adds counts, list items, and the owner dropdown to this component (it modifies, not replaces, the file). | must | ui-context, reference 02-editor-chrome, PRD-004 | AC-017, AC-018 |
| FR-013 | `AiSidebar` shall compose `SidebarPanel` (`side="right"`, `id="ai-sidebar"`, label "AI Workspace") with header title "AI Workspace", subtitle "Collaborate with drawArc", a `Bot` icon, a close button, and a body slot defaulting to an empty state "The AI design agent arrives in a later release." | must | ui-context "Copy", reference 20-ai-sidebar-shell | AC-019 |
| FR-014 | `EditorShell` (`'use client'`) shall own `sidebarOpen`/`aiOpen` state (both `false` initially), render `EditorNavbar`, `ProjectSidebar`, optional `AiSidebar` (only when the `aiSidebar` prop is provided), and `children` in a `main` that fills the viewport below the navbar; it shall expose `useEditorChrome()` returning `{ sidebarOpen, toggleSidebar, aiOpen, toggleAi }`. | must | US-5, D-F01-4 | AC-020 |
| FR-015 | `AppDialog` shall render a shadcn `Dialog` content with `rounded-3xl`, backdrop blur, title (required), description (optional), body, footer slot; `ConfirmDialog` shall render title, description, Cancel + confirm buttons, use the destructive button variant when `destructive`, never render an input, disable both buttons while `pending`, and focus the Cancel button on open. | must | ui-context "Dialogs", D-F01-8 | AC-021, AC-022 |
| FR-016 | `EmptyState` shall render an `h-8 w-8` icon, a heading, an optional description, and an optional action; `app/editor/page.tsx` shall render `EditorShell` with `EmptyState` heading "Create a project or open an existing one" and description "Start a new architecture workspace, or choose a project from the sidebar." | must | ui-context "Copy", D-F01-5 | AC-023 |
| FR-017 | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` shall be restyled with tokens and shadcn `Button`, keeping F00 copy and behaviour. | must | F00/FR-014 | AC-024 |
| FR-018 | No file under `app/**` or `components/**` except `components/ui/**` shall contain a hex colour literal or a raw palette class (`zinc-`, `gray-`, `slate-`, `neutral-`, `stone-`, `white`, `black` as colour utilities); `types/canvas.ts` and `app/globals.css` are the only allowed hex locations. | must | code-standards "Styling" | AC-025 |
| FR-019 | Text tokens shall meet WCAG contrast on the surfaces they are used on: `--text-primary` and `--text-secondary` ≥ 4.5:1 on all four backgrounds; `--text-muted` ≥ 4.5:1 on `--bg-base`, `--bg-surface`, `--bg-elevated`; `--accent-primary`, `--accent-ai-text`, `--state-error/success/warning` ≥ 4.5:1 on `--bg-base`; `--accent-ai-foreground` (`#ffffff`) on `--accent-ai` ≥ 4.5:1 (text on `bg-ai` buttons, D-F01-2a). `--text-faint` and muted-on-subtle are decorative-only (see EC-010). | must | NFR-006 | AC-026 |
| FR-020 | Every icon-only button in F01 shall have `aria-label` and a tooltip; all interactive chrome shall show a visible focus ring (`focus-visible:ring-2 ring-brand`); an automated a11y scan of `/editor` with both sidebars open and closed shall report zero `serious`/`critical` violations. | must | NFR-006, US-1 | AC-027 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-006 | FR-009–FR-011, FR-015, FR-019, FR-020: inert closed panels, focus management, Esc, visible focus, contrast test, axe scan, reduced motion. |
| NFR-007 | All components typed; `LucideIcon` type for icon props; no `any`. |
| NFR-010 | `@xyflow/react ~12.12` pin (D-023) checked by F00's pin test. |

## UX and interaction behaviour

Layout (desktop ≥ 768px): navbar `fixed top-0 inset-x-0 h-14 z-40 bg-base/95 border-b border-surface-border backdrop-blur`; main `pt-14 min-h-dvh`; left panel `fixed top-14 bottom-0 left-0 w-80 z-30 bg-base/95 border-r border-surface-border`; right panel mirrored with `border-l`. Open panel adds `shadow-xl`; closed panel has `shadow-none`. Mobile (< 768px): panel width `w-[85vw] max-w-80`; scrim `fixed inset-x-0 top-14 bottom-0 z-20 bg-base/60 md:hidden`.

| State | Left panel classes | Attributes |
|---|---|---|
| open | `translate-x-0 visible shadow-xl` + `[transition:transform_200ms_ease-out,visibility_0s]` | `aria-hidden="false"`, no `inert` |
| closed | `-translate-x-full invisible shadow-none` + `[transition:transform_200ms_ease-out,visibility_0s_200ms]` | `aria-hidden="true"`, `inert` |

Keyboard: `Tab` order is navbar left → center → right → (open panels in DOM order) → main. `Escape` inside a panel closes it and returns focus to its opener. shadcn Tabs: arrow keys switch tabs (Radix default). Dialogs: Esc closes, focus trapped and restored (shadcn defaults, not overridden).

Copy (exact): navbar title "drawArc"; toggle labels "Open projects sidebar" / "Close projects sidebar"; sidebar header "Projects"; close buttons "Close projects sidebar" / "Close AI sidebar"; tabs "My Projects", "Shared with me"; empty states as FR-012; button "New Project"; AI header "AI Workspace" / "Collaborate with drawArc"; AI empty state "The AI design agent arrives in a later release."; page empty state as FR-016; `ConfirmDialog` cancel label "Cancel".

Responsive: navbar center text truncates (`truncate`) under 480px; the AI sidebar is mounted only when supplied, so the editor home never shows it.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Panel closed, after the 200 ms transition | bounding box entirely outside the viewport (`right <= 0` for left, `left >= innerWidth` for right); computed `visibility: hidden`; no shadow painted (the reference "peeking" bug, including shadow-bleed and `overflow` causes) | AC-010, AC-011 |
| EC-002 | Panel closed, user presses Tab repeatedly | no element inside the panel receives focus (`inert`) | AC-012 |
| EC-003 | Panel opened while a dialog is open | dialog keeps focus trap; Esc closes the dialog first (Radix layer), not the panel | AC-013 (Manual note) |
| EC-004 | Window resized from mobile to desktop while open | scrim disappears (`md:hidden`), panel stays open, no layout shift of `main` | AC-015 |
| EC-005 | `prefers-reduced-motion: reduce` | computed `transition-duration` is `0s`; end states identical | AC-016 |
| EC-006 | Opener element unmounted before close (e.g. navigation) | focus return is skipped safely (`ref.current` null check); no error thrown | AC-014 |
| EC-007 | `ProjectSidebar` rendered without `onNewProject` | button rendered `disabled` with tooltip "Sign in to create a project" (F02/F04 enable it) | AC-018 |
| EC-008 | `ConfirmDialog` `onConfirm` returns a pending promise | both buttons disabled; Esc still closes (user intent wins; the action keeps running — callers handle idempotency) | AC-022 |
| EC-009 | Very long project title in navbar center (F04) | `truncate` with `title` attribute; verified now with a 200-char string | AC-009 |
| EC-010 | `--text-muted` on `--bg-subtle` measures ≈ 4.3:1 and `--text-faint` ≈ 2.6:1 on `--bg-base` (computed from the ui-context values) | these combinations are restricted to decorative/non-essential text (placeholders, dividers); essential text on `bg-subtle` uses `text-copy-secondary`; recorded for the owner (token values may be retuned without a decision-log entry) | AC-026 |
| EC-011 | shadcn CLI cannot detect Tailwind v4 (Turbopack loader, no PostCSS config) | write `components.json` by hand with `"tailwind": { "css": "app/globals.css", "cssVariables": true }` and run `shadcn add`; record in status.md | AC-004 (Manual note) |
| EC-012 | Both sidebars open on mobile | only the most recently opened stays open (opening one closes the other below `md`) | AC-020 |
