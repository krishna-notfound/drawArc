// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ServerEnvSchema } from '@/lib/env';
import { PublicEnvSchema } from '@/lib/env.public';

const lines = readFileSync('.env.example', 'utf8').split(/\r?\n/);
const keyLines = lines
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => /^[A-Z0-9_]+=/.test(line));
const exampleKeys = keyLines.map(({ line }) => line.slice(0, line.indexOf('=')));
const schemaKeys = [...Object.keys(ServerEnvSchema.shape), ...Object.keys(PublicEnvSchema.shape)];

describe('.env.example (F00 AC-007)', () => {
  it('contains only comments, blank lines, and empty assignments', () => {
    lines.forEach((line) => expect(line).toMatch(/^(#.*|[A-Z0-9_]+=)?$/));
  });

  it('documents every schema key', () => {
    schemaKeys.forEach((key) => expect(exampleKeys).toContain(key));
  });

  it('adds only test-only keys beyond the schema', () => {
    exampleKeys
      .filter((key) => !schemaKeys.includes(key))
      .forEach((key) => expect(key).toMatch(/^E2E_[A-Z0-9_]+$/));
  });

  it('precedes every key with a comment naming the activating feature', () => {
    keyLines.forEach(({ index }) => expect(lines[index - 1]).toMatch(/^#.*(F0|F1|M2|tests)/));
  });
});
