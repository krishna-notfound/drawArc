# F26 — Status

| Field | Value |
|---|---|
| Status | Approved — implementation authorized (2026-10-28, D-066) |
| Spec approved | 2026-10-28, owner (D-066) |
| Implementation authorized | 2026-10-28, owner — batch 1 |
| Last verified | — |

## History
- 2026-10-28 — drafted by the spec-writer session from D-052 (landing page approved, supersedes F02 FR-005), D-062 (custom auth is F27), D-064 (F26/F27 as separate parallel packages) and research R-015 / `docs/research/landing-and-auth.md` §F-10, §F-11 / `docs/research/excalidraw/00-summary.md` §2 C7, §4, §6 Q13. Clerk facts verified against the installed `@clerk/nextjs` 7.9.20 types; Next.js facts against the bundled 16.4.2 docs (paths in `00-overview.md`). Counts: FR ×16, EC ×9, AC ×15, TC ×14, T ×5.
- 2026-10-28 — Approved by owner with batch 1 (D-066); the 14 local decisions in `docs/research/batch1-owner-decisions.md` adopted as recommended. Implementation authorized (Sonnet 5.5 agent, own worktree).

## Evidence
- None yet. Required at T-005: `npm run check`, `npm run build` (route table showing `○ /`), `npm run e2e` output; preview URL; Lighthouse ×3; `/opengraph-image`, `/robots.txt`, `/sitemap.xml` screenshots or curl output; commit hashes (author `krishna <krishnagtkr@gmail.com>`).

## Open issues
- D-F26-1 (PROPOSED): session-aware CTA via client-side `useAuth()`; static HTML carries the signed-out variant. Owner to approve. Alternative (`auth()` in Suspense) makes `/` partial-prerendered.
- D-F26-2 (PROPOSED): new optional `NEXT_PUBLIC_SITE_URL`; owner must set it in Vercel (production and preview) once the domain exists (F15). Until then OG/sitemap/robots URLs on the preview point at `http://localhost:3000` — acceptable for review, not for production.
- D-F26-3 (PROPOSED): one-line `metadataBase` edit to the owner's `app/layout.tsx`; page-level metadata on `/` leaves F01 AC-008 untouched.
- D-F26-4 (PROPOSED): OG colours duplicated in `lib/site.ts` with a parity test (precedent `EDGE_STROKE`).
- D-F26-5 (PROPOSED): feature cards deviate from the brief — "export" replaced by "Sharing & roles" (F19 export is deferred) and "notes" narrowed to "Text & labels" (sticky notes are not merged). Owner may accept, or approve "coming soon" badges for export/notes instead.
- D-F26-6 (open, F27): `afterSignOutUrl` stays `/sign-in` in F26; F27 decides whether sign-out lands on `/`.
- D-F26-7 (open): confirm the GitHub repository is public before shipping the footer link; otherwise drop the link or point it elsewhere.
- Headline/sub-line copy (FR-003) and card copy (FR-005) are proposals; the owner may edit wording before approval (strings are single-sourced in `copy.ts`, so later edits are cheap).
- F02 supersession: FR-005/AC-007 retired by this feature; `tests/e2e/auth.spec.ts` amended in T-004. F02 `status.md` carries the supersession note (2026-10-28).
- Resolved at validation (2026-10-28): `features/README.md` (graph + index, F26 depends on 01, supersedes F02 FR-005) and `context/progress-tracker.md` (row 26, Awaiting Approval) updated in the batch-1 consistency pass; two table-breaking pipes escaped (FR-015, AC-013).
- UNVERIFIED (resolved at T-001/T-004): `twitter:image` fallback (moot via `twitter-image.tsx`), Satori default-font rendering of the em dash, `instant()` on a fully static route, repository visibility.
