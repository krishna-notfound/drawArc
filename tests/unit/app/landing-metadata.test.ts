// @vitest-environment node
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Keeps `@clerk/nextjs` out of the unit run.
vi.mock('@/components/landing/session-cta', () => ({ SessionCta: () => null }));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x');
});

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
    const token = (name: string) => css.match(new RegExp(String.raw`${name}:\s*(#[0-9a-fA-F]{3,8})`))![1];
    const { OG_THEME } = await import('@/lib/site');
    expect({ background: OG_THEME.background, text: OG_THEME.text, brand: OG_THEME.brand }).toEqual({
      background: token('--bg-base'),
      text: token('--text-primary'),
      brand: token('--accent-primary'),
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
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /next\/headers|@clerk\/nextjs\/server|\b(cookies|headers|connection|auth)\(/,
      );
    },
  );
});

describe('app/page metadata (FR-008, AC-007)', () => {
  const title = 'drawArc — Collaborative system-design canvas and whiteboard';
  const description =
    'Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team.';
  it('exports the static title, description, Open Graph and Twitter fields', async () => {
    const { metadata } = await import('@/app/page');
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.openGraph).toEqual({ type: 'website', siteName: 'drawArc', url: '/', title, description });
    expect(metadata.twitter).toEqual({ card: 'summary_large_image', title, description });
  });
  it('app/page.tsx is synchronous and imports no request-time API (FR-001, Review Focus 2)', () => {
    const source = readFileSync('app/page.tsx', 'utf8');
    expect(source).not.toMatch(
      /next\/headers|@clerk\/nextjs\/server|\b(cookies|headers|connection|auth)\(|Suspense|async function/,
    );
  });
  it('the hero illustration is an aria-hidden inline SVG of at most 3 KB with no hex colour (FR-003)', () => {
    const source = readFileSync('components/landing/hero-illustration.tsx', 'utf8');
    expect(Buffer.byteLength(source)).toBeLessThanOrEqual(3072);
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
