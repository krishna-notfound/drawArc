// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'generated') yield* sources(path);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      yield path;
    }
  }
}

// F15 T-002 gate: an error body built by hand would miss `requestId` (FR-007); every route answers errors via
// `errorResponse` in lib/errors.ts. Comments are stripped so documentation may still show the envelope.
it('builds every JSON error body through lib/errors.ts (F15 FR-007)', () => {
  const offenders = [...sources('app'), ...sources('lib')]
    .filter((file) => file.replaceAll('\\', '/') !== 'lib/errors.ts')
    .filter((file) => /\berror:\s*\{/.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
  expect(offenders).toEqual([]);
});
