// @vitest-environment node
import { globSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { CreateProjectInput, RenameProjectInput } from '@/schemas/project';

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger }));

const { AccessError, toActionError } = await import('@/lib/errors');

describe('toActionError (F03 AC-024)', () => {
  it('keeps expected codes, maps Zod and Prisma errors, and logs only the unknown one', () => {
    const ctx = { op: 'renameProject', userId: 'u1', projectId: 'p1' };
    const zod = RenameProjectInput.safeParse({ projectId: 'cjld2cjxh0000qzrmn831i7rn', name: ' ' }).error;
    const results = [
      new AccessError('FORBIDDEN'),
      zod,
      Object.assign(new Error('unique'), { code: 'P2002' }),
      Object.assign(new Error('missing'), { code: 'P2025' }),
      new Error('boom'),
    ].map((err) => toActionError(err, ctx));

    expect(results.map((r) => r.code)).toEqual(['FORBIDDEN', 'VALIDATION', 'CONFLICT', 'NOT_FOUND', 'UPSTREAM']);
    expect(results[0]).toStrictEqual({ code: 'FORBIDDEN', message: "You don't have permission to do that." });
    expect(results[1]?.fieldErrors?.name).toEqual(['Name is required']);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ...ctx, err: expect.any(Error) }), expect.any(String));
  });
});

describe('project input schemas (F03 AC-012)', () => {
  it('defaults an empty create name and enforces the length limits', () => {
    expect(CreateProjectInput.parse({}).name).toBe('Untitled Project');
    expect(CreateProjectInput.parse({ name: '   ' }).name).toBe('Untitled Project');
    expect(CreateProjectInput.safeParse({ name: 'A'.repeat(100) }).success).toBe(true);
    expect(CreateProjectInput.safeParse({ name: 'A'.repeat(101) }).error?.issues[0]?.path).toEqual(['name']);
    expect(CreateProjectInput.safeParse({ description: 'x'.repeat(501) }).error?.issues[0]?.path).toEqual(['description']);
  });
});

describe('no REST project routes in M1 (F03 AC-027, D-024)', () => {
  it('has no route handler under app/api/projects other than the F13 canvas route', () => {
    const routes = globSync('app/api/projects/**/route.{ts,tsx,js}').filter((p) => !p.replaceAll('\\', '/').includes('/canvas/'));
    expect(routes).toEqual([]);
  });
});
