// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerEnvSchema } from '@/lib/env';

const script = resolve('scripts/check-bundle-secrets.mjs');
const SENTINEL = 'sk_SENTINEL_x';

function run(cwd: string) {
  // The child process inherits the stubbed environment.
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
}

beforeEach(() => {
  vi.stubEnv('CLERK_SECRET_KEY', SENTINEL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function builtTree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'f00-bundle-'));
  mkdirSync(join(dir, '.next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(dir, '.next', 'static', 'chunks', 'a.js'), 'console.log("ok")');
  return dir;
}

describe('scripts/check-bundle-secrets.mjs (F00 AC-028, F15 AC-021)', () => {
  it('passes on a clean build output', () => {
    expect(run(builtTree()).status).toBe(0);
  });

  it('fails when a sentinel secret appears in the client bundle, without printing the value', () => {
    const dir = builtTree();
    writeFileSync(join(dir, '.next', 'static', 'chunks', 'leak.js'), `const k = "${SENTINEL}";`);
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('CLERK_SECRET_KEY');
    expect(result.stdout + result.stderr).not.toContain(SENTINEL);
  });

  it('allows publishable keys but fails on a secret-shaped string, naming the pattern only (F15 AC-021, EC-012)', () => {
    const dir = builtTree();
    writeFileSync(join(dir, '.next', 'static', 'chunks', 'pk.js'), 'const pk = "pk_test_c2VudGluZWwuY2xlcmsuYWNjb3VudHMuZGV2JA";');
    expect(run(dir).status).toBe(0);

    const leaked = 'whsec_' + 'A'.repeat(32);
    writeFileSync(join(dir, '.next', 'static', 'chunks', 'leak.js'), `const s = "${leaked}";`);
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('webhook signing secret');
    expect(result.stdout + result.stderr).not.toContain(leaked);
  });

  it('asks for a build when .next/static is missing', () => {
    const result = run(mkdtempSync(join(tmpdir(), 'f00-bundle-')));
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('run build first');
  });

  it('checks exactly the service keys of ServerEnvSchema', async () => {
    const { SERVER_KEYS } = (await import('../../../scripts/check-bundle-secrets.mjs')) as { SERVER_KEYS: string[] };
    const schemaKeys = Object.keys(ServerEnvSchema.shape).filter((key) => key !== 'NODE_ENV' && key !== 'LOG_LEVEL');
    expect([...SERVER_KEYS].sort()).toEqual(schemaKeys.sort());
  });
});
