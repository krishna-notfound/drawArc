# F26 — Implementation Plan (outline)

## Dependencies to be installed

None. `next/og` (`ImageResponse`), `@clerk/nextjs` 7.9.20 (`useAuth`), `lucide-react`, shadcn `Button`/`Card`/`Badge`, `@axe-core/playwright` 4.14, `@next/playwright` are already present. Any new package requires owner approval.

## Environment variables added

| Key | Where | Required | Value |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `lib/env.public.ts` (`z.url().optional()`), `.env.example` (empty line + comment) | no (falls back to `http://localhost:3000`) | production/preview origin, set by the owner in Vercel (D-F26-2); never a secret |

## Migrations

None. No external-service or dashboard change. Setting the Vercel env var is an owner action, not part of the implementation.

## Tasks

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | `lib/site.ts` (`SITE_NAME`, `SITE_DESCRIPTION`, `OG_THEME`, `siteUrl()`), `NEXT_PUBLIC_SITE_URL` in `lib/env.public.ts` and `.env.example`, `metadataBase` in `app/layout.tsx`; `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `twitter-image.tsx`; unit test file | FR-008 (layout line), FR-009, FR-010, FR-011, FR-012 | `lib/site.ts`, `lib/env.public.ts`, `.env.example`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `tests/unit/app/landing-metadata.test.ts` | AC-008, AC-009, AC-010 pass; F00 env-example test still green |
| T-002 | `components/landing/copy.ts` + `session-cta.tsx` (client island on `useAuth`, hero/header variants, fixed-height slot) | FR-004 | `components/landing/copy.ts`, `components/landing/session-cta.tsx` | `tsc` clean; narrows the `UseAuthReturn` union without casts |
| T-003 | Presentational sections and the page: header, hero (+ inline SVG ≤ 3 KB), feature grid (6 cards, "Coming soon" badge), how-it-works (`ol`), footer; `app/page.tsx` rewrite with static `metadata`; remove the F02 redirect | FR-001, FR-002, FR-003, FR-005, FR-006, FR-007, FR-008, FR-013 (markup part), FR-015 | `components/landing/{landing-header,hero,hero-illustration,feature-grid,how-it-works,landing-footer}.tsx`, `app/page.tsx` | AC-007 passes; `npm run build` shows `○ /` (AC-001 evidence captured); AC-014 guards green |
| T-004 | Playwright spec: static shell, landmarks/headings, signed-out CTA routing, signed-in CTA swap (user A `storageState`), copy audit, axe at two viewports, Tab order and focus ring, reduced motion; amend `tests/e2e/auth.spec.ts` (drop the `/` assertion, keep `/editor`) | FR-001, FR-002–FR-007, FR-013, FR-016 | `tests/e2e/landing.spec.ts`, `tests/e2e/auth.spec.ts` | AC-002, AC-003, AC-004, AC-005, AC-006, AC-011, AC-012, AC-015 pass locally |
| T-005 | Verification and evidence: `npm run check`, `npm run build`, `npm run e2e`; on the preview deployment run Lighthouse ×3, capture request list and HTML byte count, open `/opengraph-image`, `/robots.txt`, `/sitemap.xml`; record in status.md with the commit hash | FR-014, AC-001, AC-008 (visual), AC-013 | `features/26-landing-page/status.md` | AC-001 and AC-013 recorded with actual output; all TCs run |

Order: T-001 → T-002 → T-003 → T-004 → T-005. T-001 and T-002 are independent and may run in parallel. Each task ≤ 1 day; the whole feature is ~1.5–2 days (research estimate 1–2).

Notes for Gate 6 planning:
- `app/layout.tsx` and `app/page.tsx` are owner-touched files (F01/F02 history). F26 edits exactly one line of the layout and replaces the page; report both diffs explicitly in the task report.
- Do not add `export const runtime` to the OG route even though the Next docs show Node-runtime examples; the default is already Node and the F00 lint bans the export.
- Keep every string in `copy.ts`; the e2e spec imports the same module so copy edits stay single-sourced.
- Commit grouping (owner cadence): (1) site config + metadata routes + unit test, (2) landing components + page, (3) e2e specs + auth.spec amendment, (4) status/evidence.
