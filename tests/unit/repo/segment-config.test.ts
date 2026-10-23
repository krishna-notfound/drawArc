// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

it('has no Cache-Components-incompatible segment exports under app/ (F00 AC-013)', () => {
  const offenders = sourceFiles('app').filter((file) =>
    /export const (runtime|dynamic|revalidate|fetchCache|dynamicParams)\b/.test(readFileSync(file, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
