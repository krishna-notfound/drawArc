// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AccessError, AppError, ERROR_CODES, errorResponse, httpStatusFor, isAppError } from '@/lib/errors';

describe('lib/errors (F00 FR-012)', () => {
  it('maps every code to its HTTP status (AC-019)', () => {
    expect(ERROR_CODES).toHaveLength(8);
    expect(ERROR_CODES.map(httpStatusFor)).toEqual([401, 403, 404, 400, 409, 429, 502, 500]);
  });

  it('allows a 422 override only for VALIDATION (AC-020)', () => {
    expect(new AppError('VALIDATION', 'too big', { status: 422 }).status).toBe(422);
    expect(() => new AppError('CONFLICT', 'x', { status: 422 })).toThrow();
  });

  it('builds AccessError as an AppError with a reason (AC-020)', () => {
    const error = new AccessError('FORBIDDEN', 'not-a-member');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.reason).toBe('not-a-member');
    expect(error).toBeInstanceOf(AppError);
    expect(isAppError(error)).toBe(true);
  });

  it('turns an AppError into a JSON response (AC-021)', async () => {
    const response = errorResponse(new AppError('NOT_FOUND'));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });

  it('turns a ZodError into a 400 with field errors (AC-021)', async () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    if (parsed.success) throw new Error('expected a validation failure');
    const response = errorResponse(parsed.error);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; fieldErrors: Record<string, string[]> } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.fieldErrors.a).toBeDefined();
  });

  it('rethrows unexpected errors instead of converting them (AC-021, EC-010)', () => {
    expect(() => errorResponse(new Error('x'))).toThrow('x');
  });
});
