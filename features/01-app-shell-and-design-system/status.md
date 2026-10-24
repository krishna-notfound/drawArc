# F01 — Status

| Field | Value |
|---|---|
| Status | Verification — implemented and independently verified; awaiting owner review / merge |
| Spec approved | 2026-10-23, owner (incl. local decisions D-F01-1 … D-F01-8 and D-F01-2a) |
| Implementation authorized | 2026-10-23, owner (one implementation-specialist agent, directly from the spec) |
| Last verified | 2026-10-23, commit `0f0dfe6` on `feat/f01-app-shell-and-design-system` (stacked on F00; not merged, not pushed) |

## History
- 2026-10-22 — drafted by planning session (Gate 3).
- 2026-10-22 — Gate 4 audit fixes applied: D-037 token names, "Shared with me" tab label (aligned with F04/PRD-004), AC-002 split into L1/L3 (AC-002b), T-012 FR links. See `features/AUDIT-2026-10-22.md`.

- 2026-10-23 — Spec approved by owner. Branch `feat/f01-app-shell-and-design-system` stacked on `feat/f00-product-foundation` (F00 PR pending GitHub `workflow` scope). Planner agent writing the plan.
- 2026-10-23 — Implemented by implementation agent in 4 commits (`5740a05..b4d0b14`); final review (fresh reviewer): 1 Critical (`--color-base` overrode Tailwind `text-base` font size → invisible Input/Textarea text), 2 Important (focus restore on panel swap; unapproved `cn` dependency), minors. Owner approved D-041; fix commit `0f0dfe6`. Clean-clone failure (committed scaffold `app/page.tsx` violated no-raw-colour test) fixed by committing the owner's page and `public/*.svg` deletions.
## Evidence

Commits (author/committer `krishna <krishnagtkr@gmail.com>`, no AI trailers): `5740a05` tokens + shadcn primitives + React Flow CSS · `59ad826` providers, navbar, sidebars, shell · `ddfe790` /editor placeholder, dialog pattern, error pages · `b4d0b14` axe + keyboard e2e · `0f0dfe6` review fixes (D-041).

Independent verification by the main session, 2026-10-23:

| Check | Result |
|---|---|
| `npm run check` | exit 0 — 32 files, 214/214 tests |
| `npm run build` | exit 0 — `○ /`, `○ /_not-found`, `○ /editor`; no blocking-prerender messages |
| Built CSS | `.text-base{font-size:var(--text-base);line-height:…}` (D-041 regression gone) |
| `npm run e2e` | 18 passed (incl. axe scan with project sidebar closed/open, inert/Tab, reduced motion, text-base regression, main height) |
| Clean clone of `0f0dfe6`, no `.env.local` | `npm ci`, `npm run check` (214/214), `npm run build` all exit 0 |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| GitHub CI | PR #2 https://github.com/krishna-notfound/drawArc/pull/2 (stacked on #1), run https://github.com/krishna-notfound/drawArc/actions/runs/39991563982: check 214/214, build OK, check:bundle none found, audit 0 |

Dependencies added: @xyflow/react 12.12.0 (`~12.12.0`), radix-ui 1.8.1, cn 0.5.0 (D-041; `lib/utils.ts` re-exports it; clsx/tailwind-merge removed), lucide-react 1.61.0, class-variance-authority 0.7.1, tw-animate-css 1.4.0; dev @axe-core/playwright 4.14.0, @testing-library/user-event 14.6.8.

Implementer rulings (full list in the agent ledger, summarised): 18 tokens (AC-001 says 17; `--accent-ai-foreground` added by D-F01-2a); `dark:` variant always on; base border colour bound to token; inactive tab text `copy-secondary` for contrast; icon buttons forced to 20px; `[box-shadow:none]` on closed panel; `icon-button.tsx` avoids `transition-all` (it delayed visibility and blocked focus); `EmptyState` `as` heading prop; `AppDialog` composed from Radix parts for the blurred overlay; `global-error.tsx` imports globals.css (no Geist variables — accepted); axe excludes `nextjs-portal`; jsdom `ResizeObserver` stub; `text-base` regression probe element on /editor.


## Open issues
- D-F01-2 closed by D-037 (`bg-ai`/`text-ai-text`; shadcn `--accent` → `--bg-subtle`). New PROPOSED D-F01-2a: `--accent-ai-foreground: #ffffff` / `text-ai-foreground` for text on `bg-ai` buttons — owner to confirm or add to `ui-context.md`.
- EC-010: `--text-muted` on `--bg-subtle` ≈ 4.3:1, `--text-faint` on `--bg-base` ≈ 2.6:1; owner may retune values or accept the decorative-only scoping in FR-019.
- D-F01-1: `@xyflow/react` installed in F01 for the stylesheet only (component arrives in F06); owner to confirm or move the import to F06.
- D-F01-5: placeholder `app/editor/page.tsx` created here, gated in F02, replaced in F04; owner to confirm this hand-off.
- D-F01-7: `app/layout.tsx` metadata changes from "ghost ai" to drawArc copy — the only edit to the owner's layout file besides body classes and `Providers`.
- UNVERIFIED items (shadcn CLI on Turbopack-only Tailwind, React 19.3 `inert`, `@axe-core/playwright`, `lucide-react` version) are resolved and recorded at T-002/T-004/T-010.
- AC-027 partially verified: axe scan with the AI panel open is deferred to F04/F16 (no AI toggle exists on editor home in F01).
- Not done (manual): 1280×800 / 390×844 screenshots, dialog-over-open-sidebar check (EC-003), screen-reader spot check.
- Deferred minors from review: Esc on a focused panel button also dismisses its tooltip and the panel together; built CSS contains unused rules (e.g. `--color-zinc-900`), probably because Tailwind's source detection scans untracked `No_touch_ai/`/`docs/` — consider `@source not` exclusions later.
