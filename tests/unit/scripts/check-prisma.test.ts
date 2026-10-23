// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = resolve('scripts/check-prisma.mjs');

function run(cwd: string) {
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
}

describe('scripts/check-prisma.mjs (F00 AC-015)', () => {
  it('skips when there is no Prisma schema (EC-004)', () => {
    const result = run(mkdtempSync(join(tmpdir(), 'f00-prisma-')));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('prisma validate: skipped (no schema yet)');
  });

  it('fails when a schema exists but prisma is not installed (EC-005)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'f00-prisma-'));
    mkdirSync(join(dir, 'prisma'));
    writeFileSync(join(dir, 'prisma', 'schema.prisma'), '');
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('prisma validate: schema present but prisma is not installed');
  });
});
