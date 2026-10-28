# F26 — Status

| Field | Value |
|---|---|
| Status | Completed — merged to `main` via PR #18 (2026-10-28); AC-013 Lighthouse pending a preview deployment |
| Spec approved | 2026-10-28, owner (D-066) |
| Implementation authorized | 2026-10-28, owner — batch 1 |
| Last verified | 2026-10-28 |

## History
- 2026-10-28 — drafted by the spec-writer session from D-052 (landing page approved, supersedes F02 FR-005), D-062 (custom auth is F27), D-064 (F26/F27 as separate parallel packages) and research R-015 / `docs/research/landing-and-auth.md` §F-10, §F-11 / `docs/research/excalidraw/00-summary.md` §2 C7, §4, §6 Q13. Clerk facts verified against the installed `@clerk/nextjs` 7.9.20 types; Next.js facts against the bundled 16.4.2 docs (paths in `00-overview.md`). Counts: FR ×16, EC ×9, AC ×15, TC ×14, T ×5.
- 2026-10-28 — Approved by owner with batch 1 (D-066); the 14 local decisions in `docs/research/batch1-owner-decisions.md` adopted as recommended. Implementation authorized (Sonnet 5.5 agent, own worktree).
- 2026-10-28 — Implemented on `feat/f26-landing-page` (T-001 to T-004); verification evidence recorded below (T-005). AC-013 (Lighthouse on a deployed preview) is unmet: no deployment exists and deploying needs separate owner authorization (CLAUDE.md §6).

## Evidence
Commits on `feat/f26-landing-page` (author and committer `krishna <krishnagtkr@gmail.com>`, no AI attribution, not pushed):
- `e628784` feat(landing): site config, NEXT_PUBLIC_SITE_URL, OG image, robots and sitemap (T-001)
- `8cc6738` feat(landing): static landing page with session-aware CTA island (T-002, T-003)
- `bfbe486` test(landing): e2e coverage for the landing page; retire the F02 '/' redirect assertion (T-004)
- the commit carrying this file (T-005; it also slims the feature cards, see ruling R-2)

Gates on the final tree:
- `npm run check`: exit 0 — typegen, `tsc`, `eslint`, Vitest 77 files / 528 tests passed, `prisma validate` valid. Earlier runs flaked once each on machine load (integration DB `P2002` on parallel migrate, jsdom 5 s timeouts) and passed on rerun without a code change.
- `npm audit --audit-level=high`: found 0 vulnerabilities.
- `npm run build` route table (AC-001): `○ /`, `○ /opengraph-image`, `○ /twitter-image`, `○ /robots.txt`, `○ /sitemap.xml`; `◐ /editor`, `◐ /editor/[projectId]`, `◐ /sign-in/[[...sign-in]]`, `◐ /sign-up/[[...sign-up]]`; no `blocking-prerender` message.
- `npm run e2e` (`E2E_PORT=3026`, 4 workers, 79 tests including setup): run 1 stopped at the setup test (cold dev-server `/editor` navigation timeout); run 2 passed 75 of 79, with four unrelated collaboration or sharing tests failing on "Something went wrong loading this project" while other worktrees loaded the shared services; those specs rerun alone with one worker: 15 of 15 passed. Classified as load flakes; none touches the landing page. New and amended specs on their own run: `landing.spec.ts` 8 passed, `auth.spec.ts` 9 passed (17 of 17).
- Local production server (`npm run start`, `NEXT_PUBLIC_SITE_URL` unset): `/robots.txt` shows `Disallow: /editor`, `Disallow: /api`, `Sitemap: http://localhost:3000/sitemap.xml`; `/sitemap.xml` has three `<url>` (`/`, `/sign-in`, `/sign-up`; priorities 1, 0.5, 0.5); `/opengraph-image` and `/twitter-image` return `200 image/png` (44589 bytes); `curl -s / | wc -c` = 40480 (budget 40960); the signed-out static HTML contains no "Go to your projects".
- OG image visual (manual note, AC-008): 1200x630, near-black background, "drawArc" large in the brand cyan, tagline in light text wrapping onto two lines, legible. The Satori default-font check is resolved; the em dash appears only in `alt`, not in the image.
- FR-013 utility audit (AC-012 inspection): `grep -rn "copy-muted\|copy-faint" components/landing` returns nothing; text utilities used are `text-copy-primary`, `text-copy-secondary` and `text-brand` only.

AC mapping:
- AC-001: build route table above. AC-002 to AC-006, AC-011, AC-012: `tests/e2e/landing.spec.ts`. AC-007 to AC-010: `tests/unit/app/landing-metadata.test.ts`. AC-014: `no-raw-colors` and `segment-config` tests inside `npm run check`. AC-015: `tests/e2e/auth.spec.ts` (amended).
- AC-013: UNMET until a preview deployment exists (Lighthouse x3, request list and byte count on the deployed URL). The local byte count (40480) is inside the budget.

Rulings:
- R-1: `instant()` accepts the fully static route; the `page.request.get('/')` assertions run as well (the EC-007 fallback was not needed).
- R-2: the plan's `CardHeader` and `CardContent` wrappers were dropped (flat `Card` with icon, `h3`, optional `Badge`, `p`). Their long default class lists are serialised twice (HTML plus the flight payload) and left the document at 43911 bytes, over the FR-014 budget of 40960; the flat card gives 40480. Roles, headings and copy are unchanged.
- R-3: the `.env.example` comment names F15 so the F00 env-example guard passes (plan note).

## Open issues
- D-F26-1 (ADOPTED, D-066 decision 11): session-aware CTA via client-side `useAuth()`; static HTML carries the signed-out variant. Owner to approve. Alternative (`auth()` in Suspense) makes `/` partial-prerendered.
- D-F26-2 (ADOPTED, D-066 decision 12): new optional `NEXT_PUBLIC_SITE_URL`; owner must set it in Vercel (production and preview) once the domain exists (F15). Until then OG/sitemap/robots URLs on the preview point at `http://localhost:3000` — acceptable for review, not for production.
- D-F26-3 (ADOPTED, D-066 decision 12): one-line `metadataBase` edit to the owner's `app/layout.tsx`; page-level metadata on `/` leaves F01 AC-008 untouched.
- D-F26-4 (ADOPTED, D-066 decision 13): OG colours duplicated in `lib/site.ts` with a parity test (precedent `EDGE_STROKE`).
- D-F26-5 (ADOPTED, D-066 decision 13): feature cards deviate from the brief — "export" replaced by "Sharing & roles" (F19 export is deferred) and "notes" narrowed to "Text & labels" (sticky notes are not merged). Owner may accept, or approve "coming soon" badges for export/notes instead.
- D-F26-6 (open, F27): `afterSignOutUrl` stays `/sign-in` in F26; F27 decides whether sign-out lands on `/`.
- D-F26-7 (decided per decision 14: link kept; owner confirms repository visibility): confirm the GitHub repository is public before shipping the footer link; otherwise drop the link or point it elsewhere.
- Headline/sub-line copy (FR-003) and card copy (FR-005) are proposals; the owner may edit wording before approval (strings are single-sourced in `copy.ts`, so later edits are cheap).
- F02 supersession: FR-005/AC-007 retired by this feature; `tests/e2e/auth.spec.ts` amended in T-004. F02 `status.md` carries the supersession note (2026-10-28).
- Resolved at validation (2026-10-28): `features/README.md` (graph + index, F26 depends on 01, supersedes F02 FR-005) and `context/progress-tracker.md` (row 26, Awaiting Approval) updated in the batch-1 consistency pass; two table-breaking pipes escaped (FR-015, AC-013).
- Resolved at T-001/T-004: `twitter:image` fallback (moot via `twitter-image.tsx`), Satori default-font rendering (OG note above), `instant()` on a fully static route (R-1). Still open: repository visibility (D-F26-7).
- AC-013 unmet until a preview deployment exists; owner to authorise deployment and set `NEXT_PUBLIC_SITE_URL` on Vercel.
