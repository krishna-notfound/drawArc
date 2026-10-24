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
// Read by Clerk itself, never by lib/env*; their values are public routes, so the example carries them (F02 FR-007).
const CLERK_ROUTING: Record<string, string> = {
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/editor',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/editor',
};

describe('.env.example (F00 AC-007, F15 AC-007)', () => {
  it('contains only comments, blank lines, and empty assignments (except Clerk routing)', () => {
    lines
      .filter((line) => !Object.keys(CLERK_ROUTING).some((key) => line.startsWith(`${key}=`)))
      .forEach((line) => expect(line).toMatch(/^(#.*|[A-Z0-9_]+=)?$/));
  });

  it('documents the Clerk routing keys with their exact values (F02 AC-010)', () => {
    Object.entries(CLERK_ROUTING).forEach(([key, value]) => expect(lines).toContain(`${key}=${value}`));
  });

  it('documents every schema key', () => {
    schemaKeys.forEach((key) => expect(exampleKeys).toContain(key));
  });

  it('adds only test-only and Clerk routing keys beyond the schema', () => {
    exampleKeys
      .filter((key) => !schemaKeys.includes(key) && !(key in CLERK_ROUTING))
      .forEach((key) => expect(key).toMatch(/^E2E_[A-Z0-9_]+$/));
  });

  // F15 AC-007: the inventory table in the F15 design, the Zod schemas and .env.example agree.
  it('validates every inventory row marked "validated: yes" in the env schemas (F15 AC-007)', () => {
    const design = readFileSync('features/15-observability-and-deployment/02-design.md', 'utf8');
    const inventory = design.slice(design.indexOf('## Environment inventory'), design.indexOf('Preview webhook note'));
    const validated = inventory
      .split(/\r?\n/)
      .map((row) => row.split('|').map((cell) => cell.trim()))
      .filter((cells) => cells.length > 5 && /^yes\b/.test(cells[5] ?? ''))
      .map((cells) => (cells[1] ?? '').replaceAll('`', ''));
    expect(validated.length).toBeGreaterThan(0);
    validated.forEach((key) => expect(schemaKeys).toContain(key));
  });

  it('precedes every key with a comment naming the activating feature', () => {
    keyLines.forEach(({ index }) => expect(lines[index - 1]).toMatch(/^#.*(F0|F1|M2|tests)/));
  });
});
