# F26 — Test Plan

Budget (testing-strategy "Test budget"): one Playwright spec and one Vitest file. Trivial criteria (static route table, utility-class audit, visual OG check, Lighthouse) are verified by `next build`, inspection or a recorded manual run, not by tests.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-007 | L1 | `tests/unit/app/landing-metadata.test.ts` | import `metadata` from `@/app/page`; read `app/layout.tsx` | compare fields; regex `metadataBase: new URL\(siteUrl\(\)\)` | all FR-008 fields exact; layout line present |
| TC-002 | AC-009 | L1 | same file | `vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')`, `vi.resetModules()` | call `robots()`, `sitemap()` | one rule with `disallow ['/editor','/api']`, sitemap URL absolute; three sitemap entries, priorities 1/0.5/0.5, no `lastModified` |
| TC-003 | AC-010 | L1 | same file | env unset; `https://a.test/`; `not-a-url` | `siteUrl()`; `PublicEnvSchema.safeParse` | `http://localhost:3000`; `https://a.test`; parse failure; `.env.example` contains `NEXT_PUBLIC_SITE_URL=` |
| TC-004 | AC-008 | L1 | same file | import both image modules; parse `:root` of `app/globals.css` | compare `size`, `contentType`, `alt`, default identity; `OG_THEME` vs `--bg-base`, `--text-primary`, `--accent-primary` | exact; identical function; token parity (fails naming the drifted token, EC-009) |
| TC-005 | AC-002, AC-003 | L3 | `tests/e2e/landing.spec.ts` | `test.use({ storageState: { cookies: [], origins: [] } })`; `instant()` | `goto('/')`; status; url; landmark counts; `h1`/`h2`/`h3` order | 200, stays on `/`; one of each landmark; one `h1` = headline; `h2` ×2 |
| TC-006 | AC-004 | L3 | same file | signed-out | query CTA links in `main`/`banner`; click "Open the editor"; back; click "Sign in" | hrefs as FR-004; both end on `/sign-in` |
| TC-007 | AC-005 | L3 | same file | default project `storageState` (user A, `playwright/.auth/user-a.json`) | `goto('/')`; capture primary button box from static HTML; wait for "Go to your projects"; re-measure; click | no redirect; label/href swap within 10 s; box equal ± 1 px; ends on `/editor` with the empty-state heading |
| TC-008 | AC-006 | L3 | same file | import `LANDING_COPY` | assert each feature title/body, badge on AI card only, `ol > li` ×3 with step copy, footer links/attributes | all present and exact; `h3` count = 9 |
| TC-009 | AC-011 | L3 | same file | `@axe-core/playwright` (exclude `nextjs-portal`); viewports 1280×800 and 320×568 | `analyze()`; `scrollWidth` check; `Tab` ×5 from wordmark; computed `box-shadow`/`outline` on focused primary | 0 serious/critical at both sizes; no horizontal scroll; order per FR "Keyboard"; ring visible |
| TC-010 | AC-012 | L3 | same file | `emulateMedia({ reducedMotion: 'reduce' })` | computed `transition-duration` of both hero buttons | `0s` |
| TC-011 | AC-015 | L3 | `tests/e2e/auth.spec.ts` (existing, amended) | signed-out + user A | `/editor` → sign-in; `/sign-in` signed in → `/editor` | unchanged F02 behaviour; `/` assertion removed |
| TC-012 | AC-001 | L0 | — | `npm run build` | read route table | `○ /`, `○ /opengraph-image`, `○ /twitter-image`, `○ /robots.txt`, `○ /sitemap.xml`; no `blocking-prerender` for `/` |
| TC-013 | AC-013, AC-008 (visual) | Manual | — | preview deployment URL | Lighthouse mobile ×3; DevTools network; `curl -s URL \| wc -c`; open `/opengraph-image` | medians meet FR-014; no third-party/image requests besides Clerk FAPI; ≤ 40 960 bytes; OG image dark, 1200×630, shows name + tagline |
| TC-014 | AC-014 | L1 | existing `tests/unit/ui/no-raw-colors.test.ts`, `tests/unit/repo/segment-config.test.ts` | — | `npm run check` | both pass with F26 files present |

## Collaboration / concurrency cases

Not applicable — no room, no shared state.

## AUTHZ-MATRIX

Not applicable — no new endpoint or action. The generated `/robots.txt`, `/sitemap.xml`, `/opengraph-image` and `/twitter-image` are public by design; `/editor` and `/api/*` keep their F02/F03 gates (TC-011 re-checks the `/editor` gate).

## Not tested automatically, and why

- Lighthouse budget, request list and HTML size (TC-013): needs the deployed preview and a real network; recorded manually with the commit hash.
- OG image appearance (TC-013): Satori output is pixel data; the unit test proves exports and token parity, a human confirms legibility once.
- Utility-class audit for FR-013 contrast pairs: inspection of `components/landing/**` by the reviewer; the token pairs themselves are already proven by F01 TC-027.
- Hydration-mismatch absence (EC-008): covered indirectly — TC-007 would fail on a React hydration error surfaced in the console; a dedicated console-error assertion is added to TC-007 (`page.on('console')` collecting `error` entries → expect none containing "Hydration").
- Screen-reader announcement order: manual spot check (NVDA/VoiceOver) before M1 sign-off, as for F01.
