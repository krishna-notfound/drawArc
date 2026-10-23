import { NextResponse } from 'next/server';
import { z } from 'zod';

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  INTERNAL: 500,
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Sign in required.',
  FORBIDDEN: 'You do not have access to this resource.',
  NOT_FOUND: 'Not found.',
  VALIDATION: 'Invalid input.',
  CONFLICT: 'Conflict.',
  RATE_LIMITED: 'Too many requests.',
  UPSTREAM: 'An upstream service failed.',
  INTERNAL: 'Something went wrong.',
};

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS_BY_CODE[code];
}

/** An expected failure with a stable code. Only `VALIDATION` may override its status, and only to 422 (D-036). */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, opts?: { status?: 422; details?: unknown; cause?: unknown }) {
    if (opts?.status !== undefined && code !== 'VALIDATION') {
      throw new Error(`AppError: status override is only allowed for VALIDATION (got ${code})`);
    }
    super(message ?? DEFAULT_MESSAGES[code], { cause: opts?.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = opts?.status ?? httpStatusFor(code);
    this.details = opts?.details;
  }
}

/** Thrown by requireUser (F02) and requireProjectRole (F03). */
export class AccessError extends AppError {
  readonly reason?: string;

  constructor(code: Extract<ErrorCode, 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND'>, reason?: string) {
    super(code);
    this.name = 'AccessError';
    this.reason = reason;
  }
}

export interface ActionError {
  code: ErrorCode;
  message: string;
  reason?: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Maps expected errors to a JSON response; anything else is rethrown so Next.js handles it as a 500. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof z.ZodError) {
    const { fieldErrors } = z.flattenError(err);
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: DEFAULT_MESSAGES.VALIDATION, fieldErrors } },
      { status: HTTP_STATUS_BY_CODE.VALIDATION },
    );
  }
  if (isAppError(err)) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  throw err;
}
