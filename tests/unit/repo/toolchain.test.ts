// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines?: { node?: string };
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
});
