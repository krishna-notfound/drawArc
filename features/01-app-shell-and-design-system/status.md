# F01 — Status

| Field | Value |
|---|---|
| Status | drafted |
| Spec approved | — |
| Implementation authorized | — |
| Last verified | — |

## History
- 2026-10-22 — drafted by planning session (Gate 3).
- 2026-10-22 — Gate 4 audit fixes applied: D-037 token names, "Shared with me" tab label (aligned with F04/PRD-004), AC-002 split into L1/L3 (AC-002b), T-012 FR links. See `features/AUDIT-2026-10-22.md`.

## Evidence
- None yet. Expected at Gate 7: `npm run check`, `npm run build` (no `blocking-prerender-*` for `/editor`), `npm run e2e` (shell + a11y specs), TC-006 shadcn diff record, screenshots at 1280×800 and 390×844.

## Open issues
- D-F01-2 closed by D-037 (`bg-ai`/`text-ai-text`; shadcn `--accent` → `--bg-subtle`). New PROPOSED D-F01-2a: `--accent-ai-foreground: #ffffff` / `text-ai-foreground` for text on `bg-ai` buttons — owner to confirm or add to `ui-context.md`.
- EC-010: `--text-muted` on `--bg-subtle` ≈ 4.3:1, `--text-faint` on `--bg-base` ≈ 2.6:1; owner may retune values or accept the decorative-only scoping in FR-019.
- D-F01-1: `@xyflow/react` installed in F01 for the stylesheet only (component arrives in F06); owner to confirm or move the import to F06.
- D-F01-5: placeholder `app/editor/page.tsx` created here, gated in F02, replaced in F04; owner to confirm this hand-off.
- D-F01-7: `app/layout.tsx` metadata changes from "ghost ai" to drawArc copy — the only edit to the owner's layout file besides body classes and `Providers`.
- UNVERIFIED items (shadcn CLI on Turbopack-only Tailwind, React 19.3 `inert`, `@axe-core/playwright`, `lucide-react` version) are resolved and recorded at T-002/T-004/T-010.
