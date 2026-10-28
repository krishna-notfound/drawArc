# F26 — Landing Page

| Field | Value |
|---|---|
| Milestone | M1 (post-F15 batch 1, D-052) |
| Depends on | F01 (tokens, shadcn Button/Card/Badge, root layout), F02 (`/editor` gate, `/sign-in`, `ClerkProvider`), F15 (deployment; production URL for `metadataBase`) |
| Depended on by | F27 (custom auth UI reuses the wordmark/header pattern; `signOut({ redirectUrl: '/' })` may target this page) |
| Product requirements | PRD-001 (entry to sign-in), NFR-006 (accessibility); research R-015 (`docs/research/excalidraw/00-summary.md`), `docs/research/landing-and-auth.md` §F-10, §F-11 |
| Status | see status.md |

## Purpose

F26 replaces the session redirect at `/` with a static, prerendered marketing page for drawArc — a real-time collaborative system-design canvas and whiteboard. Today `/` only routes to `/editor` or `/sign-in` (`app/page.tsx:7-17`, F02 FR-005), so the product has no public face, no Open Graph preview, no sitemap and no robots policy. The page sits after F15 because its canonical URLs need the deployment, and it is deliberately thin and static: one client island decides the call-to-action label from the Clerk session; everything else is HTML produced at build time.

## Problem statement and goals

- Problem: a signed-out visitor lands on a Clerk form with no explanation of the product; shared links have no preview; crawlers are told nothing.
- G-1: `next build` reports `/` as `○ (Static)`; no request-time API (`auth()`, `cookies()`, `headers()`) is read anywhere in the route.
- G-2: Every claim on the page is backed by a feature merged to `main` (F00–F14); the AI agent is labelled "Coming soon".
- G-3: Signed-out and signed-in visitors reach the right place in one click (`/sign-in` or `/editor`) without the page becoming dynamic.
- G-4: The page is axe-clean (zero serious/critical), keyboard-operable, legible at ≥ 4.5:1, and ships no client JavaScript beyond one CTA island.
- G-5: `/` carries title, description, Open Graph + Twitter card, a generated 1200×630 OG image, `robots.txt` and `sitemap.xml`.

## Scope

In scope: `app/page.tsx` rewrite (landing), `components/landing/*` (header, hero, feature grid, how-it-works, footer, decorative inline SVG), `components/landing/session-cta.tsx` (client island), `app/opengraph-image.tsx` + `app/twitter-image.tsx`, `app/robots.ts`, `app/sitemap.ts`, `lib/site.ts` (site URL, name, description, OG theme), `metadataBase` in `app/layout.tsx`, `NEXT_PUBLIC_SITE_URL` in `lib/env.public.ts` / `.env.example`, retirement of the `/`-redirect assertion in `tests/e2e/auth.spec.ts`, one Playwright spec, one unit test file.

Out of scope / non-goals: pricing, testimonials, logo walls, stats (research §F-11: no evidence); blog, docs, changelog (never in M1); analytics (D-019 open; F15 owns observability); i18n (never in M1); light theme (never, D-016); custom auth pages and user menu (F27); sign-out redirect target (`afterSignOutUrl`, F27); screenshots or video of the editor (no external assets, FR-014); cookie banner (this page sets no cookies).

## User stories

- US-1: As a visitor, I want to understand what drawArc does in one screen so that I can decide to sign in.
- US-2: As a signed-out visitor, I want "Open the editor" or "Sign in" to take me to the sign-in page so that I reach the product in one click.
- US-3: As a signed-in user who opens `/`, I want a "Go to your projects" button so that I am not sent through sign-in again.
- US-4: As someone sharing a drawArc link in chat or social media, I want a preview card with the product name so that the link is recognisable.
- US-5: As a keyboard or screen-reader user, I want landmarks, a single `h1`, visible focus and no motion so that the page is usable (NFR-006).
- US-6 (abuse/regression): As a crawler, I must not be invited to index `/editor` or `/api`; as a visitor I must never see a claim about a feature that is not merged.

## Key decisions referenced

- D-052 (landing page approved; supersedes F02 FR-005), D-064 (F26 and F27 are separate parallel packages), D-062 (custom auth is F27 — this page links to `/sign-in` and renders no Clerk UI), D-016 (dark only), D-F01-7 (root layout metadata shape), code-standards rules 1–3 (Cache Components).
- PROPOSED D-F26-1: the session-aware CTA is a `'use client'` component using `useAuth()` from `@clerk/nextjs`; the static HTML carries the signed-out variant; once Clerk loads, signed-in users see "Go to your projects". Rationale: `useAuth` reads no request data on the server, so `/` stays `○ Static`; the server `<Show>` component awaits `auth()` (VERIFIED, `node_modules/@clerk/nextjs/dist/esm/app-router/server/controlComponents.js:6`) and `<SignedIn>/<SignedOut>` were removed in Clerk 7 (VERIFIED, `node_modules/@clerk/nextjs/dist/types/removedControlComponents.d.ts`). Alternative rejected: `auth()` in a Suspense child makes `/` `◐` partial-prerender and streams the hero buttons.
- PROPOSED D-F26-2: canonical site URL comes from a new optional `NEXT_PUBLIC_SITE_URL` (`lib/env.public.ts`), falling back to `http://localhost:3000`; the owner sets it on Vercel once the production domain exists (F15). Alternative: read `VERCEL_PROJECT_PRODUCTION_URL` — rejected because `process.env` outside `lib/env*.ts` is lint-banned (F00) and the fallback would silently change canonical URLs between preview and production.
- PROPOSED D-F26-3: `metadataBase: new URL(siteUrl())` is added to `app/layout.tsx` (one line); `/` sets its own `title.absolute`, description, Open Graph and Twitter fields in `app/page.tsx`, so F01 AC-008 (root description on `/editor`) is untouched.
- PROPOSED D-F26-4: OG image colours live in `lib/site.ts` (`OG_THEME`) and a unit test asserts they equal the `globals.css` tokens, because `ImageResponse` cannot resolve CSS variables and F01 FR-018 bans hex literals under `app/**` and `components/**` (precedent: `EDGE_STROKE` in `types/canvas.ts:43`).
- PROPOSED D-F26-5: the brief's "export" and "notes" cards are replaced by "Sharing & roles" (F12/F13) and "Text & labels" (F08/F09) because F19 export is deferred and sticky notes are not merged (G-2). Owner may restore them once those features ship.

## Reference material

- `docs/research/landing-and-auth.md` §2 (current state of `/`, metadata, layout), §F-10 (metadata/OG/sitemap/robots under Cache Components), §F-11 (justified sections; "only claim what is shipped"), §5 (unverified items); checked 2026-10-28.
- `docs/research/excalidraw/00-summary.md` R-015, §2 C7 (FR-005 supersession), §4 F26 row, §6 Q13.
- Next.js 16.4.2 bundled docs (read 2026-10-28): `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` (`title.absolute` l.291–344, `metadataBase` l.391–429, `twitter` l.674–706), `03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` (static optimisation l.91–93, `alt/size/contentType` l.257–268), `…/01-metadata/sitemap.md` (l.44–70), `…/01-metadata/robots.md` (l.22–60), `02-guides/public-static-pages.md` (static components; Suspense only for request-specific content), `02-guides/authentication-with-cache-components.md` (l.18, 49, 117), `02-guides/keeping-pages-static.md`.
- Clerk 7.9.20 installed types: `node_modules/@clerk/nextjs/dist/types/index.d.ts` (`useAuth` exported from the client boundary; `Show` is the server module), `node_modules/@clerk/shared/dist/types/hooks.d.ts:21-90` (`UseAuthReturn` union).
- Repo evidence that `ClerkProvider` without `dynamic` does not force dynamic rendering: F02 status build output `○ /_not-found`; `app/layout.tsx:36` comment.
