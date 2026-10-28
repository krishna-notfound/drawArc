# F26 — Design

## Architecture and components

Dependency direction: `app/page.tsx` → `components/landing/*` → `components/ui/*` → `lib/site.ts` → `lib/env.public.ts`. Nothing in `lib/auth.ts`, `proxy.ts`, `app/(auth)/**` or `app/editor/**` changes.

| Path | New / modified | Client/Server | Responsibility |
|---|---|---|---|
| `app/page.tsx` | rewritten (replaces the F02 redirect; D-F02-7 no longer applies) | server, static | exports `metadata`; composes the landing sections; no async, no Suspense |
| `app/layout.tsx` | modified (one line: `metadataBase`) | server | unchanged otherwise (D-F01-7 preserved) |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | new | route handler (static) | 1200×630 PNG via `ImageResponse`; twitter re-exports |
| `app/robots.ts`, `app/sitemap.ts` | new | route handler (static) | crawl policy, URL list |
| `lib/site.ts` | new | isomorphic | `SITE_NAME`, `SITE_DESCRIPTION`, `OG_THEME`, `siteUrl()` |
| `lib/env.public.ts`, `.env.example` | modified | — | `NEXT_PUBLIC_SITE_URL` (optional) |
| `components/landing/copy.ts` | new | isomorphic | every user-visible string (single source for page and tests) |
| `components/landing/landing-header.tsx`, `hero.tsx`, `feature-grid.tsx`, `how-it-works.tsx`, `landing-footer.tsx`, `hero-illustration.tsx` | new | server (no hooks, no state) | presentational sections; `hero-illustration` is an inline `<svg>` |
| `components/landing/session-cta.tsx` | new | **client** (`'use client'`) | the only island; `useAuth()` → CTA set |
| `tests/e2e/landing.spec.ts`, `tests/unit/app/landing-metadata.test.ts` | new | — | verification |
| `tests/e2e/auth.spec.ts` | modified | — | drop the `/` → `/sign-in` assertion (FR-016) |

Component tree on `/`:

```
RootLayout (ClerkProvider static → Providers)
└─ LandingPage (server, static)
   ├─ LandingHeader  [wordmark link "/"]  [nav > SessionCta variant="header"]
   ├─ main
   │  ├─ Hero  h1 · p · SessionCta variant="hero" · HeroIllustration (aria-hidden svg)
   │  ├─ FeatureGrid  section[aria-labelledby=features-heading] > h2 + 6 × Card(h3)
   │  └─ HowItWorks   section[aria-labelledby=steps-heading] > h2 + ol(3 × li(h3 + p))
   └─ LandingFooter  "drawArc" · a[GitHub, external] · a[Sign in]
```

Why the page stays static: nothing in the tree awaits request data; `SessionCta` is a client component whose server render uses Clerk's initial `isLoaded: false` state (`ClerkProvider` in the layout has no `dynamic` prop — `app/layout.tsx:36`). Next's public-pages guide confirms static components prerender without Suspense; only request-specific content needs a boundary (`02-guides/public-static-pages.md`, step 3), and the auth guide confirms a session read would be the thing that forces streaming (`authentication-with-cache-components.md` l.18, 49). F26 therefore reads the session only in the browser.

## Domain model and TypeScript contracts

```ts
// lib/site.ts
export const SITE_NAME = 'drawArc';
export const SITE_DESCRIPTION =
  'Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team.';
/** Mirrors --bg-base, --text-primary, --accent-primary in app/globals.css (ImageResponse cannot read CSS variables; guarded by TC-004). */
export const OG_THEME = { background: '#080809', text: '#f0f0f4', brand: '#00c8d4' } as const;
export function siteUrl(): string; // publicEnv.NEXT_PUBLIC_SITE_URL without trailing slash, else 'http://localhost:3000'

// lib/env.public.ts (addition)
//   NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,   // F26: canonical origin for metadata/sitemap/robots
//   schema: NEXT_PUBLIC_SITE_URL: z.url().optional(),

// components/landing/copy.ts
export const LANDING_COPY = {
  headline: 'Design systems together, in real time.',
  subline: '…FR-003…',
  cta: { open: 'Open the editor', signIn: 'Sign in', projects: 'Go to your projects' },
  features: ReadonlyArray<{ id: string; title: string; body: string; icon: LucideIcon; comingSoon?: true }>, // 6 rows, FR-005
  steps: ReadonlyArray<{ title: string; body: string }>,                                                       // 3 rows, FR-006
  footer: { github: 'GitHub', githubHref: 'https://github.com/krishna-notfound/drawArc', signIn: 'Sign in' },
} as const;

// components/landing/session-cta.tsx
'use client';
export interface SessionCtaProps { variant: 'hero' | 'header' }
export function SessionCta({ variant }: SessionCtaProps): JSX.Element;
// const auth = useAuth();  const signedIn = auth.isLoaded && auth.isSignedIn;   // UseAuthReturn union, no isLoaded guard elsewhere
// hero:   signedIn ? <Button asChild size="lg"><Link href="/editor">Go to your projects</Link></Button>
//                  : <><Button asChild size="lg"><Link href="/editor">Open the editor</Link></Button>
//                       <Button asChild size="lg" variant="outline"><Link href="/sign-in">Sign in</Link></Button></>
// header: signedIn ? <Button asChild size="sm"><Link href="/editor">Go to your projects</Link></Button>
//                  : <Button asChild size="sm" variant="outline"><Link href="/sign-in">Sign in</Link></Button>
// Wrapper: <div className="flex flex-wrap gap-3 min-h-11"> so the swap never changes the slot height (FR-004).
```

Metadata object (`app/page.tsx`): `{ title: { absolute: 'drawArc — Collaborative system-design canvas and whiteboard' }, description: SITE_DESCRIPTION, openGraph: { type: 'website', siteName: SITE_NAME, url: '/', title: …, description: … }, twitter: { card: 'summary_large_image', title: …, description: … } }`. Images are not listed: the file conventions add `og:image`/`twitter:image` with `metadataBase` resolution.

OG image (`app/opengraph-image.tsx`): `ImageResponse` of a `div` 1200×630, `background: OG_THEME.background`, `display: flex`, column, padded 80 px; "drawArc" at 120 px in `OG_THEME.brand`, tagline "Real-time collaborative system-design canvas and whiteboard" at 44 px in `OG_THEME.text`; default Satori font (no font file fetch, so no `fs`/`fetch` → static). No `runtime` export (banned; Node runtime is the default).

## Data and state ownership

No persisted or shared state. `SessionCta` reads Clerk's client session (owned by Clerk, hydrated by `ClerkProvider`); it derives nothing and stores nothing. The site URL is build-time configuration (`NEXT_PUBLIC_*`, inlined). Agrees with `data-ownership.md`: no new copy of any owned data.

## API and integration contracts

No routes, Server Actions, Liveblocks events or tasks. Static route handlers produced by Next file conventions:

| Path | Method | Auth | Produces |
|---|---|---|---|
| `/opengraph-image`, `/twitter-image` | GET | public | `image/png` 1200×630, built at `next build` |
| `/robots.txt` | GET | public | `User-Agent: *` / `Allow: /` / `Disallow: /editor` / `Disallow: /api` / `Sitemap: <siteUrl>/sitemap.xml` |
| `/sitemap.xml` | GET | public | three `<url>` entries (FR-011) |

Cross-feature contracts: F02 `/editor` gate and `/sign-in` redirect unchanged (FR-016); F27 may point `signOut({ redirectUrl })` and `afterSignOutUrl` at `/` (open, D-F26-6); F15's CSP already allows `'self'` for images/fonts/scripts, which is all this page needs.

## Security and validation

Threats: none new — the page is static, public, takes no input, sets no cookies and renders only constant strings (no `dangerouslySetInnerHTML`). The GitHub link is `rel="noopener noreferrer"`. `robots.txt` is advisory; `/editor` and `/api` remain protected server-side by F02/F03 (`requireUser`, route handlers), not by robots. `NEXT_PUBLIC_SITE_URL` is validated as a URL by Zod at startup; an attacker cannot influence it at request time (build-time inline). Authorization never depends on `SessionCta` (UI-only; the auth guide's "trusting the client" caveat, l.313).

## Verified library facts this design relies on

| Fact | Source | Date checked |
|---|---|---|
| `<SignedIn>`/`<SignedOut>`/`<Protect>` removed in `@clerk/nextjs` 7 (Core 3); rendering them throws; replacement is `<Show when="signed-in">` | `node_modules/@clerk/nextjs/dist/types/removedControlComponents.d.ts` | 2026-10-28 VERIFIED |
| The `Show` exported from `@clerk/nextjs` is the **server** component and awaits `auth()` — it would need Suspense and would make `/` partial (`◐`) | `node_modules/@clerk/nextjs/dist/types/index.d.ts` (`Show: ServerComponentsServerModuleTypes["Show"]`), `dist/esm/app-router/server/controlComponents.js:6` | 2026-10-28 VERIFIED |
| `useAuth` is exported from `@clerk/nextjs` (client boundary → `@clerk/react`) and returns `{ isLoaded: false; isSignedIn: undefined } \| { isLoaded: true; isSignedIn: false; userId: null } \| { isLoaded: true; isSignedIn: true; userId: string }` | `node_modules/@clerk/nextjs/dist/types/client-boundary/hooks.d.ts:1`, `node_modules/@clerk/shared/dist/types/hooks.d.ts:21-90` | 2026-10-28 VERIFIED |
| `ClerkProvider` without `dynamic` keeps routes static (`○ /_not-found` in the F02 build while the provider is in the layout) | `features/02-authentication-and-users/status.md` evidence table; `app/layout.tsx:36` | 2026-10-28 VERIFIED (build evidence) |
| `opengraph-image.tsx`/`sitemap.ts`/`robots.ts` are statically optimised unless they use request-time APIs or dynamic config | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md:91-93`, `sitemap.md:44`, `robots.md:22` | 2026-10-28 VERIFIED |
| `title.absolute` ignores the parent `title.template`; `metadataBase` is normally set in the root layout and composes relative URL fields; `twitter.card` etc. fields | `…/04-functions/generate-metadata.md:291-344, 391-429, 674-706` | 2026-10-28 VERIFIED |
| Static `metadata` object is preferred when metadata does not depend on the request; streaming metadata is disabled for crawler user agents anyway | `generate-metadata.md:194`; `01-getting-started/14-metadata-and-og-images.md:125` | 2026-10-28 VERIFIED |
| A page with only static components and client components that read no request data prerenders as `○`; Suspense is required only around request-specific content | `02-guides/public-static-pages.md` (steps 1 and 3); `02-guides/authentication-with-cache-components.md:117` | 2026-10-28 VERIFIED |
| `process.env` is lint-banned under `app/**` and allowed only in `lib/env*.ts`; `.env.example` must list every schema key | `tests/unit/lint/rules.test.ts:29-40`, `tests/unit/repo/env-example.test.ts` | 2026-10-28 VERIFIED |
| UNVERIFIED: whether `twitter:image` falls back to the OG image when only `opengraph-image.tsx` exists. Fallback designed in: `app/twitter-image.tsx` re-exports the generator, so the question is moot. | — | — |
| UNVERIFIED: Satori's default font renders the em dash and "drawArc" acceptably without a bundled font. Fallback: replace "—" with "·" in the OG image; a bundled font file is **not** approved (would add an asset). | — | — |
| UNVERIFIED: `@next/playwright` `instant()` behaviour on a fully static route in 16.4.2 (F01 used it on `/editor` when that route was static — TC-024 passed). Fallback: assert the `h1` from `page.content()` of the raw response via `request.get('/')`. | F01 status | — |
| UNVERIFIED: whether the repository `krishna-notfound/drawArc` is public. If private, the footer link 404s for visitors — owner decision D-F26-7. | — | — |
