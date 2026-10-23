// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PublicEnvSchema } from '@/lib/env.public';

const source = readFileSync('lib/env.public.ts', 'utf8');

describe('lib/env.public (F00 AC-006)', () => {
  it('exposes only NEXT_PUBLIC_ keys', () => {
    Object.keys(PublicEnvSchema.shape).forEach((key) => expect(key).toMatch(/^NEXT_PUBLIC_/));
  });

  it('references every key as a literal process.env expression so Next can inline it', () => {
    Object.keys(PublicEnvSchema.shape).forEach((key) => expect(source).toContain(`process.env.${key}`));
    expect(source).not.toContain('process.env[');
  });
});
