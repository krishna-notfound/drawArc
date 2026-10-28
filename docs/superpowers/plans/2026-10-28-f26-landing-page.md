# F26 Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the session redirect at `/` with a statically prerendered drawArc marketing page (one client CTA island), plus Open Graph image, `robots.txt`, `sitemap.xml` and page metadata.

**Architecture:** `app/page.tsx` becomes a plain server component composing `components/landing/*`; the only client code is `SessionCta`, which reads `useAuth()` in the browser so no request-time API touches the route and `next build` keeps `/` at `○ (Static)`. Site-wide constants (`lib/site.ts`) feed the page metadata, the `ImageResponse` OG route, robots and sitemap; a new optional `NEXT_PUBLIC_SITE_URL` supplies the canonical origin. Copy is single-sourced in `components/landing/copy.ts` and imported by the Playwright spec.

**Tech Stack:** Next.js 16.4.2 (Cache Components, `next/og` `ImageResponse`, metadata file conventions), React 19.3, `@clerk/nextjs` 7.9.20 (`useAuth`), Tailwind v4 tokens from `app/globals.css`, shadcn `Button`/`Card`/`Badge`, `lucide-react`, Zod 4, Vitest 5, Playwright 1.64 + `@axe-core/playwright` 4.14 + `@next/playwright`.

**Spec:** `features/26-landing-page/` (00–05 + `status.md`, approved 2026-10-28, D-066) and `docs/research/batch1-owner-decisions.md` decisions 11–14 (adopted as recommended). This plan cites the spec as `FR-0NN`, `AC-0NN`, `TC-0NN`, `EC-0NN`. Next.js facts: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/{opengraph-image,robots,sitemap}.md`, `.../04-functions/{generate-metadata,image-response}.md`. Clerk facts: `node_modules/@clerk/nextjs/dist/types/index.d.ts:15` (`useAuth` re-exported from the client boundary), `:25` (`SignedIn`/`SignedOut` are removed stubs), `node_modules/@clerk/shared/dist/types/hooks.d.ts:21-90` (`UseAuthReturn` union).

## Global Constraints

- Branch `feat/f26-landing-page` off `main` before Task 1 (`git switch -c feat/f26-landing-page main`). Working tree already carries the owner's unrelated changes (`.gitignore`, `AGENTS.md`, `.claude/`, `No_touch_ai/`): never stage them; commit by explicit pathspec only.
- `/` must prerender: `npm run build` route table shows `○ /` (and `○ /opengraph-image`, `○ /twitter-image`, `○ /robots.txt`, `○ /sitemap.xml`); no `auth()`, `cookies()`, `headers()`, `connection()` or Suspense-wrapped request read anywhere in the route (FR-001, AC-001).
- `process.env` is read only inside `lib/env.ts` / `lib/env.public.ts` (lint `no-restricted-syntax`); no `export const runtime|dynamic|revalidate|fetchCache|dynamicParams` under `app/**` (FR-015, `tests/unit/repo/segment-config.test.ts`).
- No hex literal or raw palette class under `app/**` or `components/**` (`tests/unit/ui/no-raw-colors.test.ts`); `OG_THEME` hex lives in `lib/site.ts` only (FR-015).
- No new dependency, no external asset, no `<img>`/`next/image`, no font file: illustration is inline SVG ≤ 3 KB with `aria-hidden="true"` and `var(--…)` colours only (FR-003, FR-014).
- Copy: product name is exactly `drawArc`; every user-visible string lives in `components/landing/copy.ts`; the AI card carries the `Badge` "Coming soon" (FR-005, G-2).
- Text utilities only from the FR-013 pairs: `text-copy-primary`, `text-copy-secondary`, `text-brand`, `text-primary-foreground` (on `bg-brand`); never `text-copy-muted`, `text-copy-faint` or shadcn `CardDescription` (its `text-muted-foreground` maps to `--text-muted`, `app/globals.css:50`).
- Accessibility: exactly one `header`/`main`/`footer`/`nav`; one `h1`, heading levels never skip; every interactive element has a visible focus ring; `prefers-reduced-motion` yields `transition-duration: 0s` on every CTA; axe reports zero serious/critical at 320, 375 and 1280 px (FR-002, FR-013).
- Tests: one Vitest file `tests/unit/app/landing-metadata.test.ts`, one Playwright spec `tests/e2e/landing.spec.ts`, one amendment to `tests/e2e/auth.spec.ts` (test budget, `05-test-plan.md`). E2E runs with `E2E_PORT` set (parallel worktrees).
- `$SCRATCH` in the commands below is the session scratchpad directory (write long logs there, quote only the tail in reports — CLAUDE.md "Keep context small").
- Commits: 4 total, one per task, each after `npm run check` passes; author and committer `krishna <krishnagtkr@gmail.com>` (verify with `git config user.name` / `user.email` — currently `krishna` / `krishnagtkr@gmail.com`); conventional messages; **no** `Co-Authored-By` or any AI attribution line; no push; no amend.

## Review Focus

1. **Signed-in visitor gets the static signed-out HTML, then a clean swap.** A request carrying user A's cookies must still receive HTML containing "Open the editor" (proof the page is not per-session) and the browser swap to "Go to your projects" must log no React hydration error. Pinned in Task 3 by `page.request.get('/')` on the signed-in context plus a `console` listener.
2. **A request-time API creeping into a metadata route.** Any later edit that imports `next/headers` or `@clerk/nextjs/server` into `page.tsx`, `opengraph-image.tsx`, `robots.ts` or `sitemap.ts` would silently turn `○` into `◐`/`ƒ`. Pinned in Task 1 (metadata routes) and Task 2 (page) by a source-scan test in the unit file.
3. **`NEXT_PUBLIC_SITE_URL` with a trailing slash or base path on a preview.** `https://preview.test/app/` must give `siteUrl() === 'https://preview.test/app'` and sitemap entries `https://preview.test/app/sign-in` with no double slash; `not-a-url` must fail Zod. Pinned in Task 1.
4. **Decorative icons leaking into accessible names.** The GitHub link's name must be exactly "GitHub" (the `ExternalLink` icon is `aria-hidden`), the AI card heading exactly "AI design agent" (badge outside the `h3`), and no `svg` may be focusable. Pinned in Task 3 (`exact: true` queries, `svg` audit).
5. **Header CTA motion and the 375 px viewport.** AC-012 names the hero buttons and AC-011 names 320/1280 px; the header CTA animates too and 375 px is the common phone width. Pinned in Task 3 by measuring all three CTAs under reduced motion and running axe/overflow at 320, 375 and 1280 px.

---

### Task 1: Site config, env var, metadata routes and OG image (spec T-001)

**Files:**
- Create: `lib/site.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`
- Modify: `lib/env.public.ts` (`publicRaw` + `PublicEnvSchema`), `.env.example` (after the `NEXT_PUBLIC_E2E_HOOKS=` line), `app/layout.tsx:23-26` (one line)
- Test: `tests/unit/app/landing-metadata.test.ts`

**Interfaces:**
- Consumes: `publicEnv` from `@/lib/env.public`.
- Produces: `lib/site.ts` → `SITE_NAME: 'drawArc'`, `SITE_DESCRIPTION: string`, `OG_THEME: { readonly background: '#080809'; readonly text: '#f0f0f4'; readonly brand: '#00c8d4' }`, `siteUrl(): string`. `PublicEnvSchema.shape.NEXT_PUBLIC_SITE_URL` (`z.url().optional()`). Route modules: `app/robots.ts` default `robots(): MetadataRoute.Robots`; `app/sitemap.ts` default `sitemap(): MetadataRoute.Sitemap`; `app/opengraph-image.tsx` exports `alt`, `size`, `contentType`, default `OpenGraphImage(): ImageResponse`; `app/twitter-image.tsx` re-exports all four.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/app/landing-metadata.test.ts` starts with `// @vitest-environment node`. Every test that touches env does `vi.resetModules(); vi.unstubAllEnvs();` in `beforeEach` and imports modules dynamically (pattern: `tests/unit/lib/env.test.ts:34-40`). Mock the island before any page import in Task 2 (not needed yet).

```ts
describe('lib/site (FR-012, AC-010)', () => {
  it('siteUrl() falls back to http://localhost:3000 when NEXT_PUBLIC_SITE_URL is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    const { siteUrl } = await import('@/lib/site');
    expect(siteUrl()).toBe('http://localhost:3000');
  });
  it('siteUrl() strips one trailing slash and keeps a base path', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://a.test/');
    expect((await import('@/lib/site')).siteUrl()).toBe('https://a.test');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.test/app/');
    expect((await import('@/lib/site')).siteUrl()).toBe('https://preview.test/app');
  });
  it('PublicEnvSchema treats NEXT_PUBLIC_SITE_URL as optional and rejects not-a-url', async () => {
    const { PublicEnvSchema } = await import('@/lib/env.public');
    const base = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x' };
    expect(PublicEnvSchema.safeParse(base).success).toBe(true);
    expect(PublicEnvSchema.safeParse({ ...base, NEXT_PUBLIC_SITE_URL: 'not-a-url' }).success).toBe(false);
  });
  it('.env.example lists NEXT_PUBLIC_SITE_URL= and app/layout.tsx sets metadataBase from siteUrl()', () => {
    expect(readFileSync('.env.example', 'utf8').split(/\r?\n/)).toContain('NEXT_PUBLIC_SITE_URL=');
    expect(readFileSync('app/layout.tsx', 'utf8')).toMatch(/metadataBase: new URL\(siteUrl\(\)\)/);
  });
  it('OG_THEME mirrors --bg-base, --text-primary and --accent-primary in app/globals.css (EC-009)', async () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const token = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`))![1];
    const { OG_THEME } = await import('@/lib/site');
    expect({ background: OG_THEME.background, text: OG_THEME.text, brand: OG_THEME.brand }).toEqual({
      background: token('--bg-base'), text: token('--text-primary'), brand: token('--accent-primary'),
    });
  });
});

describe('robots and sitemap (FR-010, FR-011, AC-009)', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test'));
  it('robots() allows / and disallows /editor and /api, pointing at the absolute sitemap', async () => {
    const robots = (await import('@/app/robots')).default;
    expect(robots()).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/editor', '/api'] }],
      sitemap: 'https://example.test/sitemap.xml',
    });
  });
  it('sitemap() lists exactly /, /sign-in and /sign-up with priorities 1, 0.5, 0.5 and no lastModified', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    expect(sitemap()).toEqual([
      { url: 'https://example.test/', changeFrequency: 'monthly', priority: 1 },
      { url: 'https://example.test/sign-in', changeFrequency: 'monthly', priority: 0.5 },
      { url: 'https://example.test/sign-up', changeFrequency: 'monthly', priority: 0.5 },
    ]);
  });
  it('sitemap() joins a base-path origin without a double slash (Review Focus 3)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.test/app/');
    expect((await import('@/app/sitemap')).default()[1]!.url).toBe('https://preview.test/app/sign-in');
  });
});

describe('OG image routes (FR-009, AC-008)', () => {
  it('opengraph-image exports alt, size, contentType and twitter-image re-exports the same function', async () => {
    const og = await import('@/app/opengraph-image');
    const tw = await import('@/app/twitter-image');
    expect(og.alt).toBe('drawArc — real-time collaborative system-design canvas and whiteboard');
    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(og.contentType).toBe('image/png');
    expect(tw.default).toBe(og.default);
    expect([tw.alt, tw.size, tw.contentType]).toEqual([og.alt, og.size, og.contentType]);
  });
  it.each(['app/opengraph-image.tsx', 'app/twitter-image.tsx', 'app/robots.ts', 'app/sitemap.ts'])(
    '%s imports no request-time API (Review Focus 2)',
    (file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(/next\/headers|@clerk\/nextjs\/server|\b(cookies|headers|connection|auth)\(/);
    },
  );
});
```

- [ ] **Step 2: Run the file to verify it fails**

Run: `npx vitest run tests/unit/app/landing-metadata.test.ts`
Expected: FAIL — `Cannot find module '@/lib/site'` (and the three route modules).

- [ ] **Step 3: Add `NEXT_PUBLIC_SITE_URL` to `lib/env.public.ts` and `.env.example`**

In `publicRaw`: `NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, // F26: canonical origin for metadata, sitemap and robots`. In `PublicEnvSchema`: `NEXT_PUBLIC_SITE_URL: z.url().optional(),`. In `.env.example`, after `NEXT_PUBLIC_E2E_HOOKS=` and a blank line, add exactly two lines — the comment must contain `F15` because `tests/unit/repo/env-example.test.ts:66` requires `/^#.*(F0|F1|M2|tests)/`:

```
# Canonical site origin for metadata, sitemap and robots, F26 (set on Vercel once the F15 domain exists); optional, defaults to http://localhost:3000
NEXT_PUBLIC_SITE_URL=
```

- [ ] **Step 4: Create `lib/site.ts`**

Exports exactly `SITE_NAME`, `SITE_DESCRIPTION`, `OG_THEME`, `siteUrl` as in the Interfaces block. `SITE_DESCRIPTION = 'Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team.'`. `OG_THEME` is `as const` with a comment naming the three CSS tokens it mirrors (guarded by the parity test). `siteUrl()` returns `(publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')`. Imports only `./env.public` (lint forbids `@/components/*` from `lib/`).

- [ ] **Step 5: Create `app/robots.ts` and `app/sitemap.ts`**

`robots(): MetadataRoute.Robots` returns the FR-010 object with `rules` as a one-element array. `sitemap(): MetadataRoute.Sitemap` maps `['/', '/sign-in', '/sign-up']` to `{ url: \`${siteUrl()}${path}\`, changeFrequency: 'monthly', priority }` with priorities `[1, 0.5, 0.5]`; no `lastModified`. Types from `import type { MetadataRoute } from 'next'`.

- [ ] **Step 6: Create `app/opengraph-image.tsx` and `app/twitter-image.tsx`**

`opengraph-image.tsx`: `import { ImageResponse } from 'next/og'`; `export const alt = 'drawArc — real-time collaborative system-design canvas and whiteboard'`; `export const size = { width: 1200, height: 630 }`; `export const contentType = 'image/png'`; `export default function OpenGraphImage() { return new ImageResponse(<div style={…}>…</div>, size); }`. The root `div` is `display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: 80, background: OG_THEME.background`; child one `SITE_NAME` at `fontSize: 120, fontWeight: 700, color: OG_THEME.brand`; child two the tagline `'Real-time collaborative system-design canvas and whiteboard'` at `fontSize: 44, color: OG_THEME.text`. No font fetch, no `runtime`/`dynamic` export, no request API. `twitter-image.tsx` is one line: `export { default, alt, size, contentType } from './opengraph-image';`.

- [ ] **Step 7: Add `metadataBase` to `app/layout.tsx`**

Add `import { siteUrl } from "@/lib/site";` (alphabetical among the `@/` imports) and insert `metadataBase: new URL(siteUrl()),` as the first property of the existing `metadata` object (`app/layout.tsx:23`). Change nothing else (FR-008, D-F26-3).

- [ ] **Step 8: Run the unit file and the existing guards**

Run: `npx vitest run tests/unit/app/landing-metadata.test.ts tests/unit/repo/env-example.test.ts tests/unit/repo/segment-config.test.ts tests/unit/ui/no-raw-colors.test.ts`
Expected: all PASS.

- [ ] **Step 9: Full quality gate**

Run: `npm run check > "$SCRATCH/f26-check-1.log" 2>&1; tail -20 "$SCRATCH/f26-check-1.log"`
Expected: typegen, `tsc`, `eslint`, `vitest` and `prisma validate` all exit 0.

- [ ] **Step 10: Commit**

```bash
git add lib/site.ts lib/env.public.ts .env.example app/layout.tsx app/robots.ts app/sitemap.ts app/opengraph-image.tsx app/twitter-image.tsx tests/unit/app/landing-metadata.test.ts
git commit -m "feat(landing): site config, NEXT_PUBLIC_SITE_URL, OG image, robots and sitemap (F26 FR-008–FR-012)"
```

---

### Task 2: Copy, session CTA island, sections and the page rewrite (spec T-002 + T-003)

**Files:**
- Create: `components/landing/copy.ts`, `components/landing/session-cta.tsx`, `components/landing/landing-header.tsx`, `components/landing/hero.tsx`, `components/landing/hero-illustration.tsx`, `components/landing/feature-grid.tsx`, `components/landing/how-it-works.tsx`, `components/landing/landing-footer.tsx`
- Modify: `app/page.tsx` (full replacement of the F02 redirect)
- Test: `tests/unit/app/landing-metadata.test.ts` (append one `describe`)

**Interfaces:**
- Consumes: `SITE_NAME`, `SITE_DESCRIPTION` from `@/lib/site`; `Button` (`asChild`, `size`, `variant`), `Card`, `CardHeader`, `CardContent`, `Badge` from `@/components/ui/*`; `useAuth` from `@clerk/nextjs`; `Link` from `next/link`.
- Produces (used by Task 3):
  - `copy.ts`: `export type FeatureId = 'collaboration' | 'shapes' | 'text' | 'templates' | 'sharing' | 'ai'`; `export const LANDING_COPY` (`as const`) with `wordmark: 'drawArc'`, `headline: 'Design systems together, in real time.'`, `subline` (FR-003 sentence), `cta: { open: 'Open the editor', signIn: 'Sign in', projects: 'Go to your projects' }`, `featuresHeading: 'Built for system design'`, `stepsHeading: 'How it works'`, `comingSoon: 'Coming soon'`, `features: readonly { id: FeatureId; title; body; comingSoon?: true }[]` (six FR-005 rows in order; only `ai` has `comingSoon: true`), `steps: readonly { title; body }[]` (three FR-006 rows), `footer: { github: 'GitHub', githubHref: 'https://github.com/krishna-notfound/drawArc', signIn: 'Sign in' }`. No React or lucide import (the Playwright spec imports this module).
  - `session-cta.tsx`: `export interface SessionCtaProps { variant: 'hero' | 'header' }`; `export function SessionCta({ variant }: SessionCtaProps): React.JSX.Element`.
  - Section components, all `(): React.JSX.Element` with no props: `LandingHeader`, `Hero`, `HeroIllustration`, `FeatureGrid`, `HowItWorks`, `LandingFooter`. `landing-header.tsx` also exports `const FOCUS_RING = 'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand'` (reused by the footer; never import it from `session-cta.tsx`, whose `'use client'` exports become client references).
  - `app/page.tsx`: `export const metadata: Metadata`; `export default function Home(): React.JSX.Element`.

- [ ] **Step 1: Append the failing page-metadata tests**

Add to `tests/unit/app/landing-metadata.test.ts`, above the first `describe`: `vi.mock('@/components/landing/session-cta', () => ({ SessionCta: () => null }));` (keeps `@clerk/nextjs` out of the unit run).

```ts
describe('app/page metadata (FR-008, AC-007)', () => {
  const title = 'drawArc — Collaborative system-design canvas and whiteboard';
  const description = 'Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team.';
  it('exports the static title, description, Open Graph and Twitter fields', async () => {
    const { metadata } = await import('@/app/page');
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.openGraph).toEqual({ type: 'website', siteName: 'drawArc', url: '/', title, description });
    expect(metadata.twitter).toEqual({ card: 'summary_large_image', title, description });
  });
  it('app/page.tsx is synchronous and imports no request-time API (FR-001, Review Focus 2)', () => {
    const source = readFileSync('app/page.tsx', 'utf8');
    expect(source).not.toMatch(/next\/headers|@clerk\/nextjs\/server|\b(cookies|headers|connection|auth)\(|Suspense|async function/);
  });
  it('the hero illustration is an aria-hidden inline SVG of at most 3 KB with no hex colour (FR-003)', () => {
    const source = readFileSync('components/landing/hero-illustration.tsx', 'utf8');
    expect(Buffer.byteLength(source)).toBeLessThanOrEqual(3072);
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/app/landing-metadata.test.ts -t "app/page metadata"`
Expected: FAIL — `metadata` undefined on the current redirect page; illustration file missing.

- [ ] **Step 3: Create `components/landing/copy.ts`**

Exactly the strings in the Interfaces block; the six feature and three step rows copy FR-005 and FR-006 verbatim (titles "Real-time collaboration", "Shapes & connectors", "Text & labels", "Starter templates", "Sharing & roles", "AI design agent"; steps "Create a project", "Invite your team", "Diagram together"). `featuresHeading` / `stepsHeading` are plan choices (the spec fixes neither); keep them in this file so the owner can edit them.

- [ ] **Step 4: Create `components/landing/session-cta.tsx`**

`'use client'`. `const auth = useAuth(); const signedIn = auth.isLoaded && auth.isSignedIn;` — narrowing the `UseAuthReturn` union, no cast. Every button is `<Button asChild size=… className={…}><Link href=…>label</Link></Button>` with the shared class `'motion-reduce:transition-none motion-reduce:duration-0'` (the shadcn `Button` sets `transition-all`; `transition-none` alone leaves Tailwind v4's 150 ms `transition-duration`, so `duration-0` is required for AC-012):

| variant | signed out (also `isLoaded: false`) | signed in |
|---|---|---|
| `hero` | primary `size="lg" className="min-w-48 …"` → `/editor` "Open the editor"; secondary `size="lg" variant="outline" className="min-w-48 …"` → `/sign-in` "Sign in" | primary `size="lg" className="min-w-48 …"` → `/editor` "Go to your projects" |
| `header` | `size="sm" variant="outline" className="min-w-44 …"` → `/sign-in` "Sign in" | `size="sm" className="min-w-44 …"` → `/editor` "Go to your projects" |

Wrapper: hero `<div className="flex min-h-11 flex-wrap gap-3">`, header `<div className="flex min-h-8 items-center">`. The `min-w-*` values keep the bounding box identical across the label swap (AC-005 ± 1 px).

- [ ] **Step 5: Create the section components**

- `landing-header.tsx`: `<header className="flex h-14 items-center justify-between border-b border-surface-border px-4 sm:px-8">` → `<Link href="/" className={cn('text-lg font-semibold text-brand', FOCUS_RING)}>{LANDING_COPY.wordmark}</Link>` and `<nav aria-label="Primary"><SessionCta variant="header" /></nav>`. This is the only `nav` on the page.
- `hero.tsx`: `<section className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">`; left column `h1` (`text-4xl font-semibold tracking-tight text-copy-primary sm:text-5xl`), `p` (`mt-4 max-w-prose text-lg text-copy-secondary`), `<SessionCta variant="hero" />` in a `mt-8` wrapper; right column `<HeroIllustration />`.
- `hero-illustration.tsx`: `<svg aria-hidden="true" viewBox="0 0 480 320" className="h-auto w-full text-brand">` with three or four `rect` nodes (`fill="var(--bg-surface)" stroke="var(--border-default)" rx="12"`) joined by `path`/`line` connectors (`stroke="currentColor"`), total file ≤ 3072 bytes, no `tabindex`, no hex.
- `feature-grid.tsx`: `<section aria-labelledby="features-heading" className="py-16">`, `<h2 id="features-heading" className="text-2xl font-semibold text-copy-primary">`, grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. `const ICONS: Record<FeatureId, LucideIcon> = { collaboration: Users, shapes: Shapes, text: Type, templates: LayoutTemplate, sharing: Share2, ai: Sparkles }`. Each card: `<Card className="gap-3 rounded-2xl border-surface-border bg-surface py-5">` → `<CardHeader className="gap-3 px-5">` containing `<Icon className="h-5 w-5 text-brand" aria-hidden="true" />`, `<h3 className="font-semibold text-copy-primary">{title}</h3>` and, when `comingSoon`, `<Badge variant="outline" className="text-copy-secondary">{LANDING_COPY.comingSoon}</Badge>` as a sibling of the `h3` (never inside it); `<CardContent className="px-5"><p className="text-sm text-copy-secondary">{body}</p></CardContent>`. Do not use `CardDescription`.
- `how-it-works.tsx`: `<section aria-labelledby="steps-heading" className="py-16">`, `<h2 id="steps-heading">`, `<ol className="mt-8 grid gap-6 md:grid-cols-3">`; each `li` has `<span aria-hidden="true" className="text-brand font-mono text-sm">0{n}</span>`, `<h3 className="mt-2 font-semibold text-copy-primary">`, `<p className="mt-1 text-sm text-copy-secondary">`.
- `landing-footer.tsx`: `<footer className="border-t border-surface-border py-8">` → inner `div` `mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-8`; `<span className="text-copy-secondary">drawArc</span>`; a `div` (not `nav`) with `<a href={githubHref} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-copy-secondary', FOCUS_RING)}>GitHub<ExternalLink className="h-4 w-4" aria-hidden="true" /></a>` and `<Link href="/sign-in" className={cn('text-copy-secondary', FOCUS_RING)}>Sign in</Link>`.

- [ ] **Step 6: Rewrite `app/page.tsx`**

Delete the F02 redirect entirely. New file: `import type { Metadata } from 'next'`, the five section imports, `SITE_DESCRIPTION`/`SITE_NAME` from `@/lib/site`. `export const metadata: Metadata` exactly as the Step 1 test expects (title `absolute`, `openGraph.url: '/'`, no `images` — the file conventions add them through `metadataBase`). `export default function Home()` returns `<><LandingHeader /><main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-8"><Hero /><FeatureGrid /><HowItWorks /></main><LandingFooter /></>`. No `async`, no `Suspense`.

- [ ] **Step 7: Run the unit file and guards**

Run: `npx vitest run tests/unit/app/landing-metadata.test.ts tests/unit/ui/no-raw-colors.test.ts tests/unit/repo/segment-config.test.ts`
Expected: all PASS.

- [ ] **Step 8: Prove the route is static**

Run: `npm run build > "$SCRATCH/f26-build-1.log" 2>&1; grep -E "(○|◐|ƒ) /|blocking-prerender" "$SCRATCH/f26-build-1.log"`
Expected: `○ /`, `○ /opengraph-image`, `○ /twitter-image`, `○ /robots.txt`, `○ /sitemap.xml`; `◐` for `/editor`, `/sign-in`, `/sign-up`; no `blocking-prerender` line. Keep the log for Task 4.

- [ ] **Step 9: Full quality gate**

Run: `npm run check > "$SCRATCH/f26-check-2.log" 2>&1; tail -20 "$SCRATCH/f26-check-2.log"`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx components/landing tests/unit/app/landing-metadata.test.ts
git commit -m "feat(landing): static landing page with session-aware CTA island (F26 FR-001–FR-007, FR-013–FR-015)"
```

---

### Task 3: Playwright landing spec and the auth.spec amendment (spec T-004)

**Files:**
- Create: `tests/e2e/landing.spec.ts`
- Modify: `tests/e2e/auth.spec.ts:25-30` and `:81-88`

**Interfaces:**
- Consumes: `LANDING_COPY` from `@/components/landing/copy` (the `@/` alias already works in e2e, see `tests/e2e/edges.spec.ts`); `instant` from `@next/playwright`; `AxeBuilder` from `@axe-core/playwright`; `playwright/.auth/user-a.json` (project default `storageState`); the `/editor` empty-state `h1` "Create a project or open an existing one".
- Produces: nothing downstream.

- [ ] **Step 1: Write `tests/e2e/landing.spec.ts`**

Helpers at the top: `const C = LANDING_COPY;` `const EMPTY_STATE = 'Create a project or open an existing one';` `const NAVIGATION = { timeout: 15_000 };` `const VIEWPORTS = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 1280, height: 800 }];` `function seriousViolations(page)` copied from `tests/e2e/shell-a11y.spec.ts:4-10`; `const banner = (page: Page) => page.getByRole('banner')`, `main`, `footer = … getByRole('contentinfo')`; `ctaDuration = (page, locator) => locator.evaluate((el) => getComputedStyle(el).transitionDuration)`.

`test.describe('landing, signed out', () => { test.use({ storageState: { cookies: [], origins: [] } }); … })` with:

- `'/ is served from the static shell with the headline and both hero CTAs (AC-002)'` — `instant(page, async () => { await page.goto('/'); await expect(page.getByRole('heading', { level: 1, name: C.headline })).toBeVisible(); await expect(main(page).getByRole('link', { name: C.cta.open })).toBeVisible(); await expect(main(page).getByRole('link', { name: C.cta.signIn })).toBeVisible(); }, { baseURL })`; then `const res = await page.request.get('/'); expect(res.status()).toBe(200); expect(new URL(res.url()).pathname).toBe('/'); expect(await res.text()).toContain(C.headline);`. (If `instant()` rejects the fully static route, the `request.get` assertions are the EC-007 fallback named in the spec — record it in status.md.)
- `'exposes one banner, nav, main and contentinfo and a single h1 followed by two h2s (AC-003)'` — each of `banner`, `navigation`, `main`, `contentinfo` `toHaveCount(1)`; `h1` count 1 with text `C.headline`; `getByText(C.subline)` visible; `const tags = await page.locator('h1, h2, h3').evaluateAll((els) => els.map((e) => e.tagName))`; `expect(tags.filter((t) => t === 'H2')).toHaveLength(2)`; `expect(tags.slice(0, 2)).toEqual(['H1', 'H2'])`; `expect(tags.filter((t) => t === 'H3')).toHaveLength(9)`.
- `'signed-out CTAs point at /editor and /sign-in and both end on /sign-in (AC-004)'` — `main` link "Open the editor" `toHaveAttribute('href', '/editor')`, `main` "Sign in" `/sign-in`, `banner` "Sign in" `/sign-in`; `page.getByRole('link', { name: C.cta.projects })` count 0; click "Open the editor" → `toHaveURL(/\/sign-in$/, NAVIGATION)`; `goto('/')`, click hero "Sign in" → same.
- `'renders the six feature cards, the three steps and the footer links with the shared copy (AC-006, Review Focus 4)'` — for each `C.features` row: `getByRole('heading', { level: 3, name: title, exact: true })` visible and `getByText(body, { exact: true })` visible; `getByText(C.comingSoon)` count 1 and it sits inside the card whose heading is "AI design agent" (`page.locator('[data-slot="card"]', { hasText: 'AI design agent' }).getByText(C.comingSoon)` visible); `page.locator('ol > li')` count 3 with each step title/body; `footer` link `{ name: 'GitHub', exact: true }` has `href` = `C.footer.githubHref`, `target="_blank"`, `rel` matching `/noopener/` and `/noreferrer/`; `footer` link "Sign in" → `/sign-in`; for each of `banner(page)`, `main(page)`, `footer(page)`: `region.locator('svg[tabindex], svg:not([aria-hidden="true"])')` count 0 (scoped to the landmarks so the `nextjs-portal` dev overlay's own icons are ignored).
- `'is axe-clean at 320, 375 and 1280 px with no horizontal scroll (AC-011, Review Focus 5)'` — for each viewport: `setViewportSize`, `goto('/')`, `expect(await seriousViolations(page)).toEqual([])`, `expect(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBe(true)`.
- `'Tab order runs wordmark, header CTA, hero primary, hero secondary, GitHub, footer Sign in with a visible ring (AC-011)'` — `setViewportSize(1280×800)`, `goto('/')`, `banner.getByRole('link', { name: 'drawArc' }).focus()`; then five `keyboard.press('Tab')` each followed by `toBeFocused()` on: `banner` "Sign in", `main` "Open the editor", `main` "Sign in", `footer` "GitHub", `footer` "Sign in". After the second Tab (hero primary focused) evaluate `{ boxShadow, outlineStyle }` and `expect(boxShadow !== 'none' || outlineStyle !== 'none').toBe(true)` (pattern `shell-a11y.spec.ts:62-70`).
- `'reduced motion zeroes the transition duration on every CTA (AC-012, Review Focus 5)'` — `page.emulateMedia({ reducedMotion: 'reduce' })`, `goto('/')`; for `main` "Open the editor", `main` "Sign in", `banner` "Sign in": `expect(await ctaDuration(page, link)).toBe('0s')`.

`test.describe('landing, signed in as user A', () => { … })` (project default `storageState`) with:

- `'/ does not redirect and swaps the CTA to "Go to your projects" without resizing or hydration errors (AC-005, EC-008, Review Focus 1)'` — collect `const errors: string[] = []; page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); })`; `setViewportSize(1280×800)`; `const raw = await (await page.request.get('/')).text(); expect(raw).toContain(C.cta.open); expect(raw).not.toContain(C.cta.projects);` (the signed-in request still receives the static signed-out HTML); open a signed-out context for the pre-swap box: `const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: {1280, 800} }); const ref = await ctx.newPage(); await ref.goto('/'); const before = await main(ref).getByRole('link', { name: C.cta.open }).boundingBox(); await ctx.close();`; then `await page.goto('/'); expect(new URL(page.url()).pathname).toBe('/'); const projects = main(page).getByRole('link', { name: C.cta.projects }); await expect(projects).toBeVisible({ timeout: 10_000 }); await expect(projects).toHaveAttribute('href', '/editor'); await expect(banner(page).getByRole('link', { name: C.cta.projects })).toBeVisible(); await expect(main(page).getByRole('link', { name: C.cta.signIn })).toHaveCount(0); await expect(banner(page).getByRole('link', { name: C.cta.signIn })).toHaveCount(0); const after = await projects.boundingBox(); expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1); expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1); expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1); expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1); expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]); await projects.click(); await expect(page).toHaveURL(/\/editor$/, NAVIGATION); await expect(page.getByRole('heading', { level: 1, name: EMPTY_STATE })).toBeVisible();`

- [ ] **Step 2: Run the new spec and verify the signed-out tests fail only where expected**

Run: `E2E_PORT=3100 npx playwright test tests/e2e/landing.spec.ts > "$SCRATCH/f26-e2e-landing.log" 2>&1; tail -30 "$SCRATCH/f26-e2e-landing.log"`
Expected: all landing tests PASS (the page exists since Task 2). If any fails, fix the component — not the assertion — unless the assertion contradicts the spec.

- [ ] **Step 3: Amend `tests/e2e/auth.spec.ts` (FR-016, AC-015)**

In `signed out` (lines 25-30): rename to `'/editor sends visitors to /sign-in (AC-008)'` and delete the two lines `await page.goto('/'); await expect(page).toHaveURL(/\/sign-in$/, NAVIGATION);` — keep the `/editor` navigation and the email-field assertion. In `signed in as user A` (lines 81-88): rename to `'/sign-in and /sign-up land on /editor without rendering a form (AC-006)'` and change the loop to `for (const path of ['/sign-in', '/sign-up'])`. Nothing else changes. Add a one-line comment above each: `// F26 supersedes F02 FR-005: '/' is now the landing page (tests/e2e/landing.spec.ts).`

- [ ] **Step 4: Run auth.spec**

Run: `E2E_PORT=3100 npx playwright test tests/e2e/auth.spec.ts > "$SCRATCH/f26-e2e-auth.log" 2>&1; tail -15 "$SCRATCH/f26-e2e-auth.log"`
Expected: all PASS.

- [ ] **Step 5: Quality gate**

Run: `npm run check > "$SCRATCH/f26-check-3.log" 2>&1; tail -20 "$SCRATCH/f26-check-3.log"`
Expected: exit 0 (lint covers `tests/e2e/**`).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/landing.spec.ts tests/e2e/auth.spec.ts
git commit -m "test(landing): e2e coverage for the landing page; retire the F02 '/' redirect assertion (F26 AC-002–AC-006, AC-011, AC-012, AC-015)"
```

---

### Task 4: Final verification, evidence and status (spec T-005)

**Files:**
- Modify: `features/26-landing-page/status.md` (Status, Last verified, Evidence, Open issues), `context/progress-tracker.md:72` (row 26)

**Interfaces:**
- Consumes: logs from Tasks 1–3 in `$SCRATCH`.
- Produces: the task report for the owner (CLAUDE.md §9).

- [ ] **Step 1: Full gates on the final tree**

Run: `npm run check > "$SCRATCH/f26-check-final.log" 2>&1; tail -20 "$SCRATCH/f26-check-final.log"`
Expected: exit 0.

Run: `npm run build > "$SCRATCH/f26-build-final.log" 2>&1; grep -E "(○|◐|ƒ) /|blocking-prerender" "$SCRATCH/f26-build-final.log"`
Expected: `○ /`, `○ /opengraph-image`, `○ /twitter-image`, `○ /robots.txt`, `○ /sitemap.xml`, `◐ /editor`, `◐ /sign-in`, `◐ /sign-up`; no `blocking-prerender` mentioning `/`. Copy the route-table lines into status.md.

Run: `E2E_PORT=3100 npm run e2e > "$SCRATCH/f26-e2e-final.log" 2>&1; tail -25 "$SCRATCH/f26-e2e-final.log"`
Expected: the whole suite passes (landing, auth and every other spec).

- [ ] **Step 2: Local audit of the generated routes and HTML size**

Run (production server from the build, with `NEXT_PUBLIC_SITE_URL` unset so the fallback shows): `npm run start -- --port 3101 > "$SCRATCH/f26-start.log" 2>&1 &` then `curl -s http://localhost:3101/robots.txt; curl -s http://localhost:3101/sitemap.xml; curl -s -o "$SCRATCH/og.png" -w "%{http_code} %{content_type} %{size_download}\n" http://localhost:3101/opengraph-image; curl -s http://localhost:3101/ | wc -c`; stop the server.
Expected: robots shows `Disallow: /editor`, `Disallow: /api`, `Sitemap: http://localhost:3000/sitemap.xml`; sitemap has three `<url>`; OG responds `200 image/png`; HTML byte count ≤ 40960. Open `$SCRATCH/og.png` with the Read tool and record: dark background, "drawArc" in brand colour, tagline legible, 1200×630 (the Satori default-font check the spec marks UNVERIFIED).

- [ ] **Step 3: Record evidence in `features/26-landing-page/status.md`**

Set `Status` to `Verification — awaiting owner review`, `Last verified` to the date; under Evidence paste: the `npm run check` tail, the build route-table lines, the e2e summary line, the curl outputs and byte count, the OG visual note, the three commit hashes with author. Mark D-F26-1…D-F26-5 as adopted under D-066 (decisions 11–13) and D-F26-6/7 as decided per decision 14 (link kept; owner confirms repository visibility). Record AC-013 (Lighthouse ×3 on the deployed preview) as **unmet until a preview deployment exists** — deployment needs separate owner authorization (CLAUDE.md §6). Record the FR-013 utility-class inspection: `grep -rn "copy-muted\|copy-faint" components/landing` returns nothing. Update `context/progress-tracker.md:72` to `Verification (2026-10-28) — awaiting owner review`.

- [ ] **Step 4: Confirm identity and commit the evidence**

Run: `git config user.name; git config user.email; git log -3 --format='%h %an <%ae> %s'`
Expected: `krishna` / `krishnagtkr@gmail.com` on all three F26 commits; no AI attribution lines in any body (`git log -3 --format=%B | grep -i "co-authored\|claude"` prints nothing).

```bash
git add features/26-landing-page/status.md context/progress-tracker.md
git commit -m "docs(landing): record F26 verification evidence and status (T-005)"
```

- [ ] **Step 5: Report to the owner (CLAUDE.md §9)**

Phase / Changed / Verification (actual command tails) / Acceptance (AC-001–AC-015 with AC-013 unmet and AC-008 visual note) / Git (four hashes) / Blockers (preview deployment for Lighthouse; owner to set `NEXT_PUBLIC_SITE_URL` on Vercel; confirm the GitHub repository is public) / Next step (owner review; no push, no merge without approval).

---

## Self-review notes (run 2026-10-28)

- Spec coverage: FR-001–FR-016 → Tasks 1 (FR-008 layout line, FR-009–FR-012), 2 (FR-001–FR-008, FR-013–FR-015), 3 (FR-002–FR-007, FR-013, FR-016), 4 (FR-014 evidence). AC-001 (build), AC-013 (preview Lighthouse, reported unmet if no deployment), AC-014 (existing guards) are verification steps, not tests, per the test budget.
- Deviations from the spec's design sketch, each with its reason in the task: icons keyed by `FeatureId` in `feature-grid.tsx` instead of `icon: LucideIcon` in `copy.ts` (keeps the Playwright import pure data); `motion-reduce:duration-0` added beside `transition-none` (Tailwind v4 keeps a 150 ms duration otherwise); `min-w-48`/`min-w-44` on CTAs (labels differ in length, AC-005 needs ± 1 px); footer links in a `div` (FR-002 allows exactly one `nav`); `.env.example` comment names F15 (the F00 comment regex has no `F2` branch); `h2` copy chosen here (spec leaves it open); viewports 320/375/1280 (AC-011 names 320/1280, the brief names 375).
