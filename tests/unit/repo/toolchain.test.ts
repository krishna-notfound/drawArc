// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines?: { node?: string };
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('toolchain (F00 AC-001)', () => {
  it('pins Node 22 in .nvmrc', () => {
    expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('22');
  });

  it('declares the supported Node range in engines', () => {
    expect(pkg.engines?.node).toBe('>=22.12 <25');
  });

  it('uses @types/node 22', () => {
    expect(pkg.devDependencies['@types/node']).toMatch(/^\^22/);
  });

  // Route-aware types such as LayoutProps are generated into .next/types; a fresh clone (and CI) has none.
  it('generates Next route types before type-checking', () => {
    expect(pkg.scripts.typecheck).toMatch(/^next typegen && tsc --noEmit/);
    expect(pkg.scripts.check).toMatch(/^next typegen && tsc --noEmit/);
  });
});
