# F01 — Design

## Architecture and components

All F01 code is `components/` and `app/` presentation; nothing in `lib/` changes except that F00's `cn()` is consumed. Dependency direction: `app/editor/page.tsx` → `components/editor/*` → `components/ui/*` → `lib/utils.ts`.

| Path | New / modified | Client/Server | Responsibility |
|---|---|---|---|
| `app/globals.css` | modified (owner's file; additive after the existing `@import "tailwindcss"`) | — | imports, tokens, `@theme inline`, shadcn variable binding, base styles |
| `components.json` | new | — | shadcn config (style `new-york`, `rsc: true`, `tsx: true`, `tailwind.css: app/globals.css`, `cssVariables: true`, `iconLibrary: lucide`, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`) |
| `components/ui/{button,card,dialog,input,textarea,tabs,scroll-area,tooltip,dropdown-menu,avatar,badge}.tsx` | generated | client | shadcn primitives, never edited |
| `app/layout.tsx` | modified (owner's file; metadata + body classes + Providers only) | server | root layout |
| `app/providers.tsx` | new | client | `TooltipProvider delayDuration={300}`; F02 nests this inside `ClerkProvider` |
| `components/editor/editor-navbar.tsx` | new | client | three-slot navbar + toggle |
| `components/editor/sidebar-panel.tsx` | new | client | floating panel primitive (transform, inert, visibility, Esc, focus, scrim) |
| `components/editor/project-sidebar.tsx` | new | client | header, tabs, empty states, New Project |
| `components/ai/ai-sidebar.tsx` | new | client | placeholder shell |
| `components/editor/editor-shell.tsx` | new | client | chrome state + composition + `useEditorChrome()` |
| `components/editor/app-dialog.tsx` | new | client | `AppDialog`, `ConfirmDialog` |
| `components/editor/empty-state.tsx` | new | server-compatible | icon + heading + description + action |
| `app/editor/page.tsx` | new | server | placeholder page (no data, no auth; F02 gates) |
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | modified | client / client / server | token styling |
| `tests/unit/ui/**`, `tests/e2e/shell.spec.ts` | new | — | verification |

Component tree on `/editor` (F01):

```
RootLayout (html.font-vars > body.bg-base.text-copy-primary.font-sans > Providers)
└─ EditorHomePage (server)
   └─ EditorShell (client; state)
      ├─ EditorNavbar  left=[toggle]  center="drawArc"  right={navbarRight}
      ├─ ProjectSidebar → SidebarPanel side=left id=project-sidebar
      ├─ (AiSidebar → SidebarPanel side=right id=ai-sidebar)   only if aiSidebar prop given
      └─ main.pt-14 > EmptyState
```

## Domain model and TypeScript contracts

```ts
// components/editor/sidebar-panel.tsx
export interface SidebarPanelProps {
  id: string;                       // 'project-sidebar' | 'ai-sidebar'
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  label: string;                    // aria-label of the <aside>
  openerRef?: React.RefObject<HTMLElement | null>;   // focus returns here on close
  children: React.ReactNode;
  className?: string;
}
// Renders: <aside id role="complementary" aria-label aria-hidden={!open} inert={!open} data-state={open?'open':'closed'} data-side>
//          + <div data-scrim onClick={onClose} /> (mobile only, when open)

// components/editor/editor-navbar.tsx
export interface EditorNavbarProps {
  sidebarOpen: boolean; onToggleSidebar: () => void;
  toggleRef?: React.RefObject<HTMLButtonElement | null>;
  center?: React.ReactNode;         // default <span className="truncate font-medium">drawArc</span>
  right?: React.ReactNode;
}

// components/editor/project-sidebar.tsx
export interface ProjectSidebarProps {
  open: boolean; onClose: () => void; openerRef?: React.RefObject<HTMLElement | null>;
  onNewProject?: () => void;        // absent → button disabled (EC-007)
  myProjects?: React.ReactNode;     // F04 supplies lists; undefined → empty state
  shared?: React.ReactNode;
}

// components/ai/ai-sidebar.tsx
export interface AiSidebarProps { open: boolean; onClose: () => void; openerRef?: React.RefObject<HTMLElement | null>; children?: React.ReactNode }

// components/editor/editor-shell.tsx
export interface EditorShellProps {
  navbarCenter?: React.ReactNode; navbarRight?: React.ReactNode;
  sidebar?: Pick<ProjectSidebarProps, 'onNewProject' | 'myProjects' | 'shared'>;
  aiSidebar?: React.ReactNode;      // content for AiSidebar; panel mounted only when defined
  children: React.ReactNode;
}
export interface EditorChrome { sidebarOpen: boolean; toggleSidebar: () => void; aiOpen: boolean; toggleAi: () => void }
export function useEditorChrome(): EditorChrome;   // throws outside EditorShell

// components/editor/app-dialog.tsx
export interface AppDialogProps { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children?: React.ReactNode; footer?: React.ReactNode }
export interface ConfirmDialogProps {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  confirmLabel: string; cancelLabel?: string; destructive?: boolean; pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

// components/editor/empty-state.tsx
export interface EmptyStateProps { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }
```

`globals.css` skeleton (authoritative; values from ui-context):

```css
@import "tailwindcss";
@import "@xyflow/react/dist/style.css";
@import "tw-animate-css";            /* added by shadcn init; keep after the two above */

:root {
  --bg-base: #080809; --bg-surface: #111114; --bg-elevated: #18181c; --bg-subtle: #1e1e23;
  --border-default: #2a2a30; --border-subtle: #3a3a42;
  --text-primary: #f0f0f4; --text-secondary: #c0c0cc; --text-muted: #808090; --text-faint: #505060;
  --accent-primary: #00c8d4; --accent-primary-dim: rgba(0,200,212,0.12);
  --accent-ai: #6457f9; --accent-ai-text: #8b82ff; --accent-ai-foreground: #ffffff;   /* last one: D-F01-2a */
  --state-error: #ff4d4f; --state-success: #34d399; --state-warning: #fbbf24;
  /* shadcn bindings — var() only */
  --background: var(--bg-base); --foreground: var(--text-primary);
  --card: var(--bg-surface); --card-foreground: var(--text-primary);
  --popover: var(--bg-elevated); --popover-foreground: var(--text-primary);
  --primary: var(--accent-primary); --primary-foreground: var(--bg-base);
  --secondary: var(--bg-subtle); --secondary-foreground: var(--text-primary);
  --muted: var(--bg-subtle); --muted-foreground: var(--text-muted);
  --accent: var(--bg-subtle); --accent-foreground: var(--text-primary);   /* shadcn hover surface — D-037 */
  --destructive: var(--state-error); --border: var(--border-default); --input: var(--border-default); --ring: var(--accent-primary);
  --radius: 0.75rem;
}
@theme inline {
  --background-color-base: var(--bg-base); /* not --color-base: that would turn text-base into a colour (D-041) */ --color-surface: var(--bg-surface); --color-elevated: var(--bg-elevated); --color-subtle: var(--bg-subtle);
  --color-surface-border: var(--border-default); --color-surface-subtle: var(--border-subtle);
  --color-copy-primary: var(--text-primary); --color-copy-secondary: var(--text-secondary); --color-copy-muted: var(--text-muted); --color-copy-faint: var(--text-faint);
  --color-brand: var(--accent-primary); --color-brand-dim: var(--accent-primary-dim);
  --color-ai: var(--accent-ai); --color-ai-text: var(--accent-ai-text); --color-ai-foreground: var(--accent-ai-foreground);   /* D-037 */
  --color-error: var(--state-error); --color-success: var(--state-success); --color-warning: var(--state-warning);
  --color-background: var(--background); --color-foreground: var(--foreground); /* … remaining shadcn --color-* lines as generated … */
  --font-sans: var(--font-geist-sans); --font-mono: var(--font-geist-mono);
  --radius-xl: 0.75rem; --radius-2xl: 1rem; --radius-3xl: 1.5rem;
}
body { background: var(--bg-base); color: var(--text-primary); }
```

The shadcn variable block contains only `var(--…)` values. `--accent-ai-foreground: #ffffff` (D-F01-2a) lives in the token block of `globals.css`, which is an allowed hex location (code-standards "Styling"); FR-018 applies to `app/**`/`components/**` TSX only.

## Data and state ownership

Client memory only: `sidebarOpen`, `aiOpen` in `EditorShell`; dialog `open` owned by callers. Nothing persisted, nothing synced (consistent with data-ownership "Viewport, selection, drag state — client memory"; chrome state is the same category). No derived copies.

## API and integration contracts

No routes, actions, events, tasks. Integration contract for later features:

| Consumer | Uses |
|---|---|
| F02 | `EditorShellProps.navbarRight` for `UserButton`; `app/providers.tsx` nested inside `ClerkProvider`; tokens for Clerk appearance variables |
| F04 | `sidebar.myProjects/shared/onNewProject`; `navbarCenter`; `useEditorChrome().toggleAi`; `AppDialog`/`ConfirmDialog` for project dialogs |
| F06 | `main` is `relative` and flush (no padding/border/radius) so `<ReactFlow>` fills it; stylesheet already imported |
| F16 | `AiSidebarProps.children` replaces the placeholder body |

## Security and validation

No external input. Threats: none beyond XSS via copy, which is static. `EmptyState`/`AppDialog` accept `ReactNode`, never `dangerouslySetInnerHTML`. shadcn generated files are reviewed once at generation (T-002) and locked by the "not edited" check (AC-005).

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| React Flow stylesheet must be imported after `@import "tailwindcss"` (Tailwind 4 ordering) and `@xyflow/react` is 12.12.0 (pin `~12.12`) | `context/architecture-context.md` (research embedded; React Flow docs checked 2026-10-22) | 2026-10-22 |
| Cache Components: a page with no runtime reads prerenders fully; client components do not skip validation; `usePathname`/`useParams` only need Suspense on dynamic routes (`/editor` is static in F01) | `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`; `02-guides/migrating-to-cache-components.md` | 2026-10-22 |
| Playwright 1.64.1: `page.emulateMedia({ reducedMotion: 'reduce' })`, `setViewportSize`, `locator.boundingBox()` available | https://playwright.dev/docs/release-notes | 2026-10-22 |
| `@next/playwright` `instant()` can assert the static shell of `/editor` | `01-app/02-guides/instant-navigation.md` | 2026-10-22 |
| UNVERIFIED: shadcn CLI version/`init` behaviour on Tailwind v4 via Turbopack loader (no PostCSS); fallback EC-011 (hand-written `components.json`). | — | — |
| UNVERIFIED: shadcn `new-york` v4 templates import `tw-animate-css` and `radix-ui`; exact generated dependency list recorded at T-002. | — | — |
| UNVERIFIED: React 19.3 renders the boolean `inert` attribute (React 19 added `inert` support; exact 19.3 behaviour not re-checked). Fallback: set via `ref.current.toggleAttribute('inert', !open)` in an effect. | — | — |
| UNVERIFIED: `@axe-core/playwright` current version and rule set; fallback: Playwright's built-in `aria` snapshot assertions for labels/roles plus manual keyboard check. | — | — |

**Resolved (D-037):** `ui-context.md` now names the AI utilities `bg-ai` / `text-ai-text`, so shadcn's `accent` (hover/focus surfaces) and the AI accent no longer share `--color-accent`. This design binds shadcn `--accent` to `--bg-subtle`. Remaining context gap: `ui-context.md` lists no foreground token for text on `bg-ai`; D-F01-2a adds `--accent-ai-foreground` (reported in the Gate 4 audit for the owner to confirm or fold into `ui-context.md`).

**Finding for the owner (EC-010):** computed from the ui-context values, `--text-muted` on `--bg-subtle` is ≈ 4.3:1 (below 4.5) and `--text-faint` on `--bg-base` ≈ 2.6:1. FR-019 scopes the contrast guarantee accordingly; retuning `--bg-subtle` to `#1c1c21` or `--text-muted` to `#8a8a9a` would clear 4.5 (values may change without a decision-log entry per ui-context).
