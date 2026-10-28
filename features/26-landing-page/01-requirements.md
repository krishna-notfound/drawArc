# F26 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority (must/should) | Source (PRD/US) | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `app/page.tsx` shall render the landing page for every visitor (signed in or not) and shall contain no `auth()`, `cookies()`, `headers()`, `connection()` or Suspense-wrapped request read; `next build` shall list `/` as `○ (Static)`. This supersedes F02 FR-005 (D-052, C7). | must | US-1, US-3, G-1 | AC-001, AC-002 |
| FR-002 | The page shall expose exactly one `header` (banner), one `main`, one `footer` (contentinfo) landmark and a `nav` inside the header; `main` shall contain, in order, the hero, the feature grid (`aria-labelledby` its `h2`), and the how-it-works section (`aria-labelledby` its `h2`); the only `h1` is the hero headline and heading levels never skip. | must | US-5, NFR-006 | AC-003, AC-011 |
| FR-003 | The hero shall render: the `h1` "Design systems together, in real time."; the sub-line "drawArc is a real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them with your team on one shared canvas."; a primary CTA; a secondary CTA; and a decorative inline SVG (`aria-hidden="true"`, ≤ 3 KB, colours via CSS variables only) or no illustration at all. | must | US-1, research §F-11 | AC-003 |
| FR-004 | `SessionCta` (`'use client'`, `components/landing/session-cta.tsx`) shall decide the CTA set from `useAuth()`: while `isLoaded` is `false` or `isSignedIn` is `false` it renders primary "Open the editor" → `/editor` and secondary "Sign in" → `/sign-in`; when `isLoaded && isSignedIn` it renders primary "Go to your projects" → `/editor` and no secondary. The header variant renders only the secondary link ("Sign in" → `/sign-in`) or, signed in, "Go to your projects" → `/editor`. The prerendered HTML contains the signed-out variant; the swap changes no element size (same `Button` size and slot width). | must | US-2, US-3, D-F26-1 | AC-004, AC-005 |
| FR-005 | The feature grid shall render exactly six `Card`s with a lucide icon (`h-5 w-5`), an `h3` title and one sentence: (1) "Real-time collaboration" — "Live cursors, presence and instant sync. Everyone edits the same canvas at once."; (2) "Shapes & connectors" — "Six shapes, resizable and colour-coded, joined by labelled connectors."; (3) "Text & labels" — "Double-click any shape or connector to write. Enter commits, Esc cancels."; (4) "Starter templates" — "Begin from a ready-made architecture template instead of a blank canvas."; (5) "Sharing & roles" — "Invite teammates by email as editors or viewers. Autosave keeps every project safe."; (6) "AI design agent" with a `Badge` "Coming soon" — "Describe a system in plain English and let the agent draft it on your canvas." No other product claim appears on the page. | must | US-1, US-6, G-2, D-F26-5 | AC-006 |
| FR-006 | The how-it-works section shall render an ordered list (`ol`) of three steps: "Create a project" — "Sign in and start a new project from the editor."; "Invite your team" — "Share it by email with editor or viewer access."; "Diagram together" — "Drop shapes, connect them, label them. Changes sync live." | must | US-1, research §F-11 | AC-006 |
| FR-007 | The footer shall render the text "drawArc", a link "GitHub" to `https://github.com/krishna-notfound/drawArc` with `rel="noopener noreferrer"` and `target="_blank"` (visually marked external via an `ExternalLink` icon), and a link "Sign in" to `/sign-in`. | must | brief | AC-006 |
| FR-008 | `app/page.tsx` shall export static `metadata` with `title: { absolute: 'drawArc — Collaborative system-design canvas and whiteboard' }`, `description: SITE_DESCRIPTION` ("Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team."), `openGraph: { type: 'website', siteName: 'drawArc', url: '/', title, description }`, `twitter: { card: 'summary_large_image', title, description }`; `app/layout.tsx` shall gain `metadataBase: new URL(siteUrl())` and no other change. | must | US-4, G-5, D-F26-3 | AC-007 |
| FR-009 | `app/opengraph-image.tsx` shall export `alt = 'drawArc — real-time collaborative system-design canvas and whiteboard'`, `size = { width: 1200, height: 630 }`, `contentType = 'image/png'` and a default function returning `new ImageResponse(...)` from `next/og` that draws "drawArc" and the tagline on `OG_THEME.background` using `OG_THEME.text`/`OG_THEME.brand` only; it shall read no request data and export no `runtime`/`dynamic`. `app/twitter-image.tsx` shall re-export `default`, `alt`, `size`, `contentType` from `./opengraph-image`. | must | US-4, G-5, D-F26-4 | AC-008 |
| FR-010 | `app/robots.ts` shall return `{ rules: [{ userAgent: '*', allow: '/', disallow: ['/editor', '/api'] }], sitemap: \`${siteUrl()}/sitemap.xml\` }`. | must | US-6, G-5 | AC-009 |
| FR-011 | `app/sitemap.ts` shall return exactly three entries whose `url`s are `siteUrl()` joined with `/`, `/sign-in`, `/sign-up` (priority 1, 0.5, 0.5; `changeFrequency: 'monthly'`; no `lastModified`, so output is deterministic). | must | G-5 | AC-009 |
| FR-012 | `lib/site.ts` shall export `SITE_NAME = 'drawArc'`, `SITE_DESCRIPTION`, `OG_THEME = { background: '#080809', text: '#f0f0f4', brand: '#00c8d4' }` and `siteUrl(): string` returning `publicEnv.NEXT_PUBLIC_SITE_URL` without a trailing slash, else `'http://localhost:3000'`; `NEXT_PUBLIC_SITE_URL` shall be added to `PublicEnvSchema` as `z.url().optional()` and to `.env.example` (empty). | must | D-F26-2, D-F26-4 | AC-010 |
| FR-013 | Every interactive element shall show a visible focus ring (`focus-visible:ring-2 ring-brand`); the page shall declare no CSS animation or transition other than button hover colour, which is `motion-reduce:transition-none`; all text shall use only the token pairs F01 FR-019 proved ≥ 4.5:1 (`text-copy-primary`/`text-copy-secondary` on `bg-base`/`bg-surface`, `text-brand` on `bg-base`, `--primary-foreground` on `bg-brand`); `text-copy-muted`/`text-copy-faint` are not used for any copy. An axe scan shall report zero `serious`/`critical` violations. | must | US-5, NFR-006 | AC-011, AC-012 |
| FR-014 | The route shall ship no client component other than `SessionCta` (plus what `app/layout.tsx` already provides), request no image, font or script from any origin other than the app itself (fonts stay `next/font`), and contain no `<img>`/`next/image`; the HTML document of `/` shall be ≤ 40 KB uncompressed. Budget on the deployed preview (Chrome Lighthouse, mobile, 4× CPU, Slow 4G): Performance ≥ 95, LCP ≤ 2.0 s, CLS ≤ 0.05, TBT ≤ 150 ms. | must | G-4, research §F-10 | AC-013 |
| FR-015 | Styling shall use tokens and shadcn `Button`, `Card`, `Badge` only; no hex literal or raw palette class under `app/**` or `components/**` (F01 FR-018 stays green with `OG_THEME` in `lib/`); no `export const runtime\|dynamic\|revalidate\|fetchCache\|dynamicParams` anywhere (F00). | must | code-standards | AC-014 |
| FR-016 | `/editor` shall keep its F02 gate (`requireUser({ unauthenticated: 'redirect' })`) and `/sign-in`, `/sign-up` their already-signed-in redirect to `/editor`; `tests/e2e/auth.spec.ts` shall drop only the `/` → `/sign-in` assertion (F02 AC-007 superseded) and keep the `/editor` one. | must | C7, F02 FR-004/FR-006 | AC-015 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-006 | FR-002, FR-013: landmarks, heading order, focus ring, reduced motion, verified contrast pairs, axe clean. |
| NFR-007 | All components typed; `SessionCta` narrows on the `UseAuthReturn` union (no `any`). |
| NFR-010 | No new dependency; `next/og` and `@clerk/nextjs` are already installed. |

## UX and interaction behaviour

Layout (mobile-first, tokens from `ui-context.md`): `header` `h-14` with the wordmark "drawArc" (`text-brand`, link to `/`) left and `SessionCta variant="header"` right; `main` stacks sections with `px-4 sm:px-8` and `max-w-5xl mx-auto`; hero `py-16 md:py-24`, two columns from `md` (copy | SVG), single column below; feature grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`, cards `bg-surface border-surface-border rounded-2xl`; how-it-works three numbered steps in a row from `md`; footer `border-t border-surface-border py-8` with the three items. Buttons: primary = shadcn `Button` default (`bg-brand`, `--primary-foreground`), `size="lg"` in the hero; secondary = `variant="outline"`. The header variant uses `size="sm"`.

| State (`useAuth()`) | Hero | Header |
|---|---|---|
| `isLoaded: false` (server HTML, first paint) | Open the editor · Sign in | Sign in |
| `isLoaded: true, isSignedIn: false` | Open the editor · Sign in | Sign in |
| `isLoaded: true, isSignedIn: true` | Go to your projects | Go to your projects |

Keyboard: Tab order = wordmark → header CTA → hero primary → hero secondary → GitHub → footer Sign in. No shortcuts, no dialogs, no motion. Copy: product name is "drawArc" (never "DrawArc"/"Draw Arc"); every string above is exact and lives in `components/landing/copy.ts` so the L3 test and the page share one source.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Clerk script blocked or slow (`isLoaded` never `true`) | Signed-out CTAs stay; "Open the editor" still works because `/editor` redirects to sign-in server-side | AC-004 |
| EC-002 | Signed-in user lands on `/` | Landing renders (no redirect); after Clerk loads the CTA swaps label/href set with no layout shift; one click reaches `/editor` | AC-005 |
| EC-003 | `NEXT_PUBLIC_SITE_URL` unset (local, CI) | `siteUrl()` = `http://localhost:3000`; sitemap/robots/OG URLs resolve locally; build succeeds | AC-010 |
| EC-004 | `NEXT_PUBLIC_SITE_URL` with trailing slash or invalid | Trailing slash stripped; invalid URL fails Zod at startup (same policy as other public keys) | AC-010 |
| EC-005 | Viewport 320 px wide | No horizontal scroll (`documentElement.scrollWidth === innerWidth`); grid single column; SVG scales (`viewBox`, `w-full h-auto`) | AC-011 |
| EC-006 | `prefers-reduced-motion: reduce` | Computed `transition-duration` on both CTA buttons is `0s` | AC-012 |
| EC-007 | Crawler without JS (OG scrapers, Twitterbot) | Static HTML already contains `h1`, meta tags and signed-out CTAs; metadata is not streamed (static `metadata` object) | AC-002, AC-007 |
| EC-008 | Hydration mismatch risk: server renders signed-out variant, client first render must match | `SessionCta` renders the signed-out variant whenever `isLoaded` is `false`, which is Clerk's initial client state; the signed-in swap happens after hydration | AC-005 |
| EC-009 | Token values in `globals.css` retuned (allowed without a decision) | Unit test comparing `OG_THEME` to the stylesheet fails and names the drifted token | AC-008 |
