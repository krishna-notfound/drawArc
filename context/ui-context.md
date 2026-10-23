# drawArc — UI Context

> Inherited from the reference design system and PROPOSED for drawArc. Token values can change without a decision-log entry; layout rules, interaction conventions, and accessibility expectations cannot.

## Theme

Dark only (D-016). A dark technical workspace: near-black backgrounds, layered surfaces, vivid accents on interactive elements.

All colours are CSS custom properties in `app/globals.css`, exposed to Tailwind v4 via `@theme inline`. Components use the token utilities — never raw palette classes (`zinc-*`) or hex literals.

| Role | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Page background | `--bg-base` | `#080809` | `bg-base` |
| Surface | `--bg-surface` | `#111114` | `bg-surface` |
| Elevated surface | `--bg-elevated` | `#18181c` | `bg-elevated` |
| Subtle surface | `--bg-subtle` | `#1e1e23` | `bg-subtle` |
| Default border | `--border-default` | `#2a2a30` | `border-surface-border` |
| Subtle border | `--border-subtle` | `#3a3a42` | `border-surface-subtle` |
| Primary text | `--text-primary` | `#f0f0f4` | `text-copy-primary` |
| Secondary text | `--text-secondary` | `#c0c0cc` | `text-copy-secondary` |
| Muted text | `--text-muted` | `#808090` | `text-copy-muted` |
| Faint text | `--text-faint` | `#505060` | `text-copy-faint` |
| Brand accent | `--accent-primary` | `#00c8d4` | `text-brand` / `bg-brand` |
| Brand dim | `--accent-primary-dim` | `rgba(0,200,212,0.12)` | `bg-brand-dim` |
| AI accent | `--accent-ai` | `#6457f9` | `bg-ai` (not `bg-accent`: shadcn reserves `accent` for hover surfaces) |
| AI text (on dark surfaces) | `--accent-ai-text` | `#8b82ff` | `text-ai-text` |
| AI foreground (on `bg-ai`) | `--accent-ai-foreground` | `#ffffff` | `text-ai-foreground` |
| Error | `--state-error` | `#ff4d4f` | `text-error` |
| Success | `--state-success` | `#34d399` | `text-success` |
| Warning | `--state-warning` | `#fbbf24` | `text-warning` |

Contrast note (NFR-006): `--text-muted` on `--bg-subtle` (~4.3:1) and `--text-faint` on `--bg-base` (~2.6:1) fall below 4.5:1 and are therefore **decorative only** (hints, timestamps, dividers) — never for text a user must read to act.

Typography: Geist Sans (`--font-geist-sans`) for UI, Geist Mono (`--font-geist-mono`) for code/ids; both via `next/font/google` as CSS variables on `<html>` (already in `app/layout.tsx`).

Radius scale increases with surface depth: `rounded-xl` inline controls, `rounded-2xl` cards/panels, `rounded-3xl` modals.

Icons: `lucide-react`, stroke only. Sizes `h-4 w-4` inline, `h-5 w-5` buttons, `h-8 w-8` empty-state feature icons.

## Component library

shadcn/ui on Tailwind v4, generated into `components/ui/` via the CLI. Generated files are **not edited**; project styling and behaviour live in app-level components that compose them. Initial set (feature 01): Button, Card, Dialog, Input, Textarea, Tabs, ScrollArea, Tooltip, DropdownMenu, Avatar, Badge.

Clerk components use Clerk's dark base theme with appearance variables mapped to our tokens (no hardcoded colours).

## Layout patterns

- **Editor home (`/editor`)**: top navbar (sidebar toggle · title · `UserButton`), floating project sidebar (left, slides in, does not push content), centred empty-state prompt with `New Project`.
- **Workspace (`/editor/[projectId]`)**: full-viewport canvas; navbar shows project name, Save status, Import template, Share, AI toggle; project sidebar floats left; AI sidebar floats right; shape palette pill at bottom-centre; control bar pill at bottom-left (zoom −/fit/+ · undo/redo); presence avatar stack + `UserButton` top-right over the canvas; connection-status pill near the avatar stack when not `connected`.
- Sidebars: `position: fixed`, higher z-index than the canvas, `bg-base/95` with `border-surface-border` and a soft shadow; fully off-screen when closed (`translateX(-100%)` / `100%`, no peeking remnant). Mobile: backdrop scrim, tap-outside closes.
- Canvas is **flush**: no border, radius, shadow, padding, or card wrapper around React Flow; the dot background fills the viewport under the floating chrome.
- Dialogs: centred, `rounded-3xl`, backdrop blur; title, description, footer actions; destructive confirmations use the destructive button variant and no input.

## Canvas visuals

**Node colour palette** — 8 pairs, stored by id (see canvas schema):

| id | Fill | Text | Character |
|---|---|---|---|
| neutral | `#1F1F1F` | `#EDEDED` | default |
| blue | `#10233D` | `#52A8FF` | |
| purple | `#2E1938` | `#BF7AF0` | |
| orange | `#331B00` | `#FF990A` | |
| red | `#3C1618` | `#FF6166` | |
| pink | `#3A1726` | `#F75F8F` | |
| green | `#0F2E18` | `#62C073` | |
| teal | `#062822` | `#0AC7B4` | |

Defined once in `types/canvas.ts` as `NODE_COLORS: Record<NodeColorId, { fill; text }>`; contrast ≥ 4.5:1 verified in a unit test (NFR-006).

**Shapes** (6): rectangle, pill, circle via CSS; diamond, hexagon, cylinder via inline SVG that scales with node size. Default sizes: rectangle 180×80, pill 180×64, circle 96×96, diamond 140×140, cylinder 140×110, hexagon 160×110. Minimum size 48×32. Borders subtle at rest (`border-surface-border`), brand-coloured when selected; selected node also shows resize handles.

**Handles**: small white dots with dark border on all four sides, `opacity: 0` at rest (never `display: none` — breaks React Flow measurement), fade in on node hover and while a connection is being dragged.

**Edges**: smooth-step, light stroke (`#f8fafc` at 60 % opacity at rest, 100 % on hover/selected), rounded caps, closed arrowhead at target, wide invisible hit area (`interactionWidth` 20). Labels are small pill badges positioned via `EdgeLabelRenderer` at the path midpoint; a faint hint shows on a selected edge with no label.

**Cursors**: Liveblocks `<Cursors/>` with the user's assigned colour and a name badge; a small spinner in the badge when `presence.thinking` is true (AI agent in M2).

**Background**: React Flow `<Background variant="dots" gap={20} />` on `bg-base`. MiniMap bottom-right, hidden under 768 px width.

## Interaction conventions

| Action | Input |
|---|---|
| Pan | scroll / middle-drag / right-drag / Space+drag |
| Zoom | ⌘/Ctrl+scroll, pinch, `+`/`=`/`-`, control bar |
| Fit view | control bar, `Shift+1` |
| Box select | drag on empty canvas (partial overlap selects) |
| Add to selection | Shift+click (box) · ⌘/Ctrl+click (toggle) |
| Add node | drag from palette; ghost preview follows cursor; drop centres node under cursor |
| Edit label | double-click node/edge; Enter commits (Shift+Enter newline in nodes); Esc cancels; blur commits |
| Delete | Delete / Backspace (not while editing text) |
| Undo / redo | ⌘/Ctrl+Z · ⌘/Ctrl+Shift+Z · ⌘/Ctrl+Y |
| Context menu | right-click node/edge/pane → duplicate, delete (feature 10; no z-order commands — `zIndex` is not synced by `@liveblocks/react-flow`) |

All shortcuts are ignored while focus is in an input, textarea, or `contenteditable`. A `?` shortcut opens a cheat-sheet dialog (feature 10).

## Accessibility expectations (NFR-006)

- Every button has a visible label or `aria-label`; icon-only buttons get a tooltip.
- Dialogs trap focus, restore it on close, close on Esc (shadcn defaults; do not override).
- Canvas uses React Flow's built-in keyboard a11y (Tab focus, Enter/Space select, arrows nudge, Esc clear) and `ariaLabelConfig` for localised announcements; node `ariaLabel` = `${shape} ${label || 'unlabelled'}`.
- Colour is never the only carrier of state (selected nodes also get a thicker border; save status has text).
- Reduced motion: sidebar/cursor animations respect `prefers-reduced-motion`.

## Copy

Product name is **drawArc** everywhere (title, metadata, sidebar header "AI Workspace — Collaborate with drawArc"). Empty-state heading: "Create a project or open an existing one"; description: "Start a new architecture workspace, or choose a project from the sidebar."
