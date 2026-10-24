// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checkPins } from '../../../scripts/check-pins.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, Record<string, string>>;

const good = {
  dependencies: {
    '@xyflow/react': '~12.12.0',
    '@liveblocks/client': '3.24.4',
    '@liveblocks/react': '3.24.4',
    '@prisma/client': '~7.10.1',
    '@prisma/adapter-neon': '~7.10.1',
  },
  devDependencies: { prisma: '~7.10.1' },
};

describe('dependency pin policy D-023 (F00 AC-002, F15 AC-024)', () => {
  it('holds for the repository package.json', () => {
    expect(checkPins(pkg)).toEqual([]);
  });

  it('accepts the canonical pins', () => {
    expect(checkPins(good)).toEqual([]);
  });

  it.each([
    ['a caret React Flow range', { '@xyflow/react': '^12.12.0' }, '@xyflow/react'],
    ['two different Liveblocks versions', { '@liveblocks/react': '3.24.5' }, 'share one version'],
    ['ranged Liveblocks versions', { '@liveblocks/client': '~3.24.4', '@liveblocks/react': '~3.24.4' }, 'must be an exact'],
    ['an unpinned Prisma', { '@prisma/client': 'latest' }, '@prisma/client must be ~7.10.x'],
  ])('reports %s by name', (_label, override, message) => {
    const failures = checkPins({ ...good, dependencies: { ...good.dependencies, ...override } });
    expect(failures.length).toBeGreaterThan(0);
    failures.forEach((failure) => expect(failure).toContain(message));
  });
});
