// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';
import { config } from '@/proxy';

// Structural guards for the two auth boundaries that a refactor could silently break.
// Next 16.4.2 ships the matcher helper as `unstable_doesMiddlewareMatch` (the docs name it `unstable_doesProxyMatch`).

describe('proxy.ts establishes the session and decides nothing (AC-001)', () => {
  const source = readFileSync('proxy.ts', 'utf8');

  it('is a bare clerkMiddleware() with no route protection or redirects of its own', () => {
    expect(source).toContain('export default clerkMiddleware()');
    for (const forbidden of ['createRouteMatcher', 'auth.protect', 'redirect(', 'export const runtime']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it.each([
    ['/editor', true],
    ['/api/webhooks/clerk', true],
    ['/sign-in/factor-one', true],
    ['/_next/static/x.js', false],
  ])('runs for %s: %s', (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(expected);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("Clerk's full User object never reaches the client (AC-025, FR-014)", () => {
  const files = [...sourceFiles('app'), ...sourceFiles('components')].map((path) => ({
    path,
    source: readFileSync(path, 'utf8'),
  }));

  it('no client component imports server-side identity APIs', () => {
    const offenders = files
      .filter(({ source }) => /^['"]use client['"]/m.test(source))
      .filter(({ source }) => /currentUser|clerkClient|@clerk\/nextjs\/server|@\/lib\/(auth|users)\b/.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it('no component passes Clerk-internal user fields as props', () => {
    const offenders = files.filter(({ source }) => /\b(clerkUser|clerkId|privateMetadata)=\{/.test(source)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
