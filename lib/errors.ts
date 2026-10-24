import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from './logger';

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

/** User-safe messages for Server Action results; the UI may show them verbatim (F03 design). */
const ACTION_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: 'That project no longer exists.',
  VALIDATION: 'Please check the highlighted fields.',
  CONFLICT: 'That conflicts with the current state. Please refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  UPSTREAM: 'Something went wrong. Please try again.',
  INTERNAL: 'Something went wrong. Please try again.',
};

export const PROJECT_ARCHIVED = 'PROJECT_ARCHIVED';
const ARCHIVED_MESSAGE = 'This project is archived. Unarchive it to make changes.';

function prismaErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  return typeof err.code === 'string' && /^P\d{4}$/.test(err.code) ? err.code : undefined;
}

function reasonOf(err: AppError): string | undefined {
  if (err instanceof AccessError) return err.reason;
  const details = err.details;
  if (typeof details === 'object' && details !== null && 'reason' in details && typeof details.reason === 'string') {
    return details.reason;
  }
  return undefined;
}

/**
 * Maps any error thrown inside a Server Action to its `ActionError` (code-standards rule 5): expected
 * failures keep their code, unknown ones become `UPSTREAM` and are logged with the action context.
 */
export function toActionError(err: unknown, ctx: { userId?: string; projectId?: string; op: string }): ActionError {
  if (err instanceof z.ZodError) {
    const fieldErrors = z.flattenError(err).fieldErrors as Record<string, string[]>;
    return { code: 'VALIDATION', message: ACTION_MESSAGES.VALIDATION, fieldErrors };
  }
  if (isAppError(err)) {
    const reason = reasonOf(err);
    const message =
      reason === PROJECT_ARCHIVED
        ? ARCHIVED_MESSAGE
        : err instanceof AccessError || err.message === DEFAULT_MESSAGES[err.code]
          ? ACTION_MESSAGES[err.code]
          : err.message;
    return reason ? { code: err.code, message, reason } : { code: err.code, message };
  }
  const prismaCode = prismaErrorCode(err);
  if (prismaCode === 'P2002') return { code: 'CONFLICT', message: ACTION_MESSAGES.CONFLICT };
  if (prismaCode === 'P2025') return { code: 'NOT_FOUND', message: ACTION_MESSAGES.NOT_FOUND };
  logger.error({ ...ctx, err }, 'server action failed');
  return { code: 'UPSTREAM', message: ACTION_MESSAGES.UPSTREAM };
}
