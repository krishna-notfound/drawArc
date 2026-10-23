// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

describe('dependency pin policy D-023 (F00 AC-002)', () => {
  it('pins @xyflow/react to ~12.12 when present', () => {
    if (all['@xyflow/react']) expect(all['@xyflow/react']).toMatch(/^~12\.12/);
  });

  it('pins every @liveblocks/* package to one exact version', () => {
    const versions = Object.entries(all)
      .filter(([name]) => name.startsWith('@liveblocks/'))
      .map(([, range]) => range);
    versions.forEach((range) => expect(range).not.toMatch(/[\^~]/));
    expect(new Set(versions).size).toBeLessThanOrEqual(1);
  });

  it('pins the Prisma trio to ~7.10 when present', () => {
    for (const name of ['prisma', '@prisma/client', '@prisma/adapter-neon']) {
      if (all[name]) expect(all[name]).toMatch(/^~7\.10/);
    }
  });
});
