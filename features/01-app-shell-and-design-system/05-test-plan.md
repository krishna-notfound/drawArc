# F01 — Test Plan

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/ui/tokens.test.ts` | `tests/fixtures/ui/tokens.json` (17 rows from ui-context) | parse `:root` block of `globals.css` | every variable present with exact value |
| TC-002 | AC-002 | L1 | `tests/unit/ui/tokens.test.ts` | — | parse `@theme inline` | all 20 mappings present (`--color-*` ×18 incl. `--color-ai`, `--color-ai-text`, `--color-ai-foreground`; `--font-sans`, `--font-mono`); no `--color-accent-text` |
| TC-003 | AC-002b | L3 | `tests/e2e/shell.spec.ts` | `/editor` | `getComputedStyle(body).backgroundColor` | `rgb(8, 8, 9)` |
| TC-004 | AC-003 | L1 | `tests/unit/ui/stylesheet-order.test.ts` | read `globals.css`, `package.json` | index comparisons; pin prefix | tailwind < xyflow < first `:root`/`@theme`; `~12.12` |
| TC-005 | AC-004 | L1 | `tests/unit/ui/shadcn-smoke.test.tsx` | `TooltipProvider` wrapper | render each primitive minimally | no throw; 11 files exist |
| TC-006 | AC-005 | Manual | — | scratch dir, same `components.json` | `npx shadcn@<ver> add … --overwrite`; `diff -r` | no differences; CLI version + output in status.md |
| TC-007 | AC-006 | L1 | `tests/unit/ui/tokens.test.ts` | — | regex over shadcn block | only `var(--…)` values; `--accent` → `--bg-subtle`, `--accent-foreground` → `--text-primary` |
| TC-008 | AC-007 | L1 | `tests/unit/ui/icons.test.tsx` | render navbar, both sidebars, empty state | query `svg.lucide` | each has exactly one allowed size pair |
| TC-009 | AC-008 | L3 | `tests/e2e/shell.spec.ts` | `/editor` | title, meta, html/body classes | `drawArc`; description; font vars; `bg-base text-copy-primary font-sans` |
| TC-010 | AC-009 | L1 | `tests/unit/ui/editor-navbar.test.tsx` | closed/open props; 200-char center | query toggle attrs, icon, center | labels/expanded/controls/icons switch; truncate + title |
| TC-011 | AC-010 | L3 | `tests/e2e/shell.spec.ts` | 1280×800 | measure closed; click toggle; wait `[data-state=open]` + `transitionend`; measure; close; measure | closed: `x+width<=0`, hidden, fixed, no shadow; open: `x===0`, visible; closed again |
| TC-012 | AC-011 | L3 | `tests/e2e/shell.spec.ts` | same page | capture `main` box + `scrollWidth` before/after open | unchanged; `documentElement.scrollWidth === innerWidth` |
| TC-013 | AC-012 | L1 | `tests/unit/ui/sidebar-panel.test.tsx` | `userEvent` | render closed with a button inside; `tab()` ×3; render open | closed: `aria-hidden`, `inert`, never focused; open: close button focused |
| TC-014 | AC-013 | L1 | `tests/unit/ui/sidebar-panel.test.tsx` | `onClose` spy | focus inside → `Escape`; focus outside → `Escape` | 1 call; then still 1 |
| TC-015 | AC-014 | L1 | `tests/unit/ui/sidebar-panel.test.tsx` | opener ref; variant with opener unmounted | open → Esc | focus on opener; no throw, `body` focused when opener gone |
| TC-016 | AC-015 | L3 | `tests/e2e/shell.spec.ts` | 390×844 then 1280×800 | open; click scrim at (380,500); reopen; resize | scrim visible/closes; desktop no scrim; stays open after resize, `main` width = viewport |
| TC-017 | AC-016 | L3 | `tests/e2e/shell.spec.ts` | `emulateMedia({ reducedMotion: 'reduce' })` | computed `transition-duration`; repeat TC-011 geometry | `0s`; geometry holds; without emulation `0.2s` |
| TC-018 | AC-017 | L1 | `tests/unit/ui/project-sidebar.test.tsx` | open, no lists; then `myProjects` slot | query heading/tabs/empty copy; `ArrowRight`; re-render with slot | exact copy; "Shared with me" panel; slot replaces empty state |
| TC-019 | AC-018 | L1 | `tests/unit/ui/project-sidebar.test.tsx` | without/with `onNewProject` | query button; hover for tooltip; click | disabled + tooltip; enabled, `w-full`, Plus icon, 1 call |
| TC-020 | AC-019 | L1 | `tests/unit/ui/ai-sidebar.test.tsx` | open, no children; closed | query copy/icons; `data-side`; closed class | exact copy; `right`; `translate-x-full` |
| TC-021 | AC-020 | L1 | `tests/unit/ui/editor-shell.test.tsx` | with/without `aiSidebar`; `matchMedia` mock < 768 | query `#ai-sidebar`; consumer component calling `toggleAi`; open both on mobile; hook outside shell | absent/present; opens; project panel closes; throws |
| TC-022 | AC-021 | L1 | `tests/unit/ui/app-dialog.test.tsx` | open with title/description/footer | roles, classes; `Escape` | name/description/footer; `rounded-3xl`; `backdrop-blur`; `onOpenChange(false)` |
| TC-023 | AC-022 | L1 | `tests/unit/ui/app-dialog.test.tsx` | destructive; pending variant | query inputs; variant; focus; click confirm | none; destructive; Cancel focused; disabled when pending; 1 call |
| TC-024 | AC-023 | L3 | `tests/e2e/shell.spec.ts` | `/editor`; `instant()` from `@next/playwright` | assert heading/description/icon in static shell | visible instantly |
| TC-025 | AC-024 | L1 | `tests/unit/app/error.test.tsx`, `not-found.test.tsx` | F00 fixtures | F00 assertions + `inline-flex` class on action | pass |
| TC-026 | AC-025 | L1 | `tests/unit/ui/no-raw-colors.test.ts` | glob `app/**`, `components/**` minus `components/ui/**` | two regexes | zero matches (fails with file:line list otherwise) |
| TC-027 | AC-026 | L1 | `tests/unit/ui/contrast.test.ts` | token values from `globals.css`; WCAG luminance helper in test | compute listed pairs; print muted/subtle + faint/base | all listed ≥ 4.5; informational ratios printed |
| TC-028 | AC-027 | L3 | `tests/e2e/shell-a11y.spec.ts` | `@axe-core/playwright` | analyse closed, then open; aria-label audit; Tab order; focus ring style | 0 serious/critical; all icon buttons labelled; Tab reaches close button; ring visible |
| TC-029 | AC-028 | L0 | — | `npm run build` | grep output for `blocking-prerender` and `/editor` | none; output in status.md |

## Collaboration / concurrency cases

Not applicable — no room, no shared state. (State interplay between the two panels on mobile is covered by TC-021.)

## AUTHZ-MATRIX

Not applicable — no endpoints. `/editor` is intentionally public in F01 and becomes gated in F02 (F02/AUTHZ-MATRIX row "GET /editor").

## Not tested automatically, and why

- Byte-identity of shadcn generated files (TC-006): requires the CLI and network; done once per generation and on upgrades.
- Visual fidelity (radius scale, shadow softness, blur strength): subjective; reviewer screenshots at 1280×800 and 390×844 attached to status.md (light-weight manual check, not a gate).
- Dialog-over-panel layering (EC-003): Radix dismissable-layer semantics are library behaviour; checked manually once.
- The AI sidebar's L3 geometry/scrim/a11y: no toggle exists on the editor home; covered at L1 here and at L3 in F04/F16 using the same `SidebarPanel` primitive already proven for the left side (TC-011, TC-016, TC-017).
- Real screen-reader announcement order: manual spot check with VoiceOver/NVDA recorded in status.md before M1 sign-off (F15).
