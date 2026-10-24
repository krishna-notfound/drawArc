import 'server-only';

import { z } from 'zod';

import { AppError, errorResponse } from './errors';
import { type LogContext, type Logger, logger as rootLogger } from './logger';

export type RequestId = string & { readonly __brand: 'RequestId' };

/**
 * A fresh id per request (F15-D1): self-generated so it behaves the same locally, in CI and on Vercel, and
 * works in Server Actions, which have no stable request header. Call it only after request data has been read
 * (Cache Components forbids random values in a prerender); `withRequest` creates its id lazily for that reason.
 */
export function newRequestId(): RequestId {
  return crypto.randomUUID() as RequestId;
}

export interface RequestContext {
  readonly requestId: RequestId;
  /** Bound to `requestId` and to every field passed to `bind`. */
  readonly log: Logger;
  /** Binds fields resolved mid-request (`userId`, `projectId`) to every later log line, failures included. */
  bind(fields: LogContext): void;
}

export interface WithRequestOptions {
  /** Headers added to error responses produced by the wrapper (e.g. `Cache-Control: no-store`). */
  headers?: HeadersInit;
  /** Injection seam for tests; defaults to the app logger. */
  logger?: Logger;
}

/**
 * Route-handler wrapper (FR-007): creates the request id and a bound logger, maps our typed failures
 * (`AppError` incl. `AccessError`, `ZodError`) to the standard error body carrying the id, and logs them at
 * `warn`. Anything else is logged at `error` and rethrown so Next.js handles it as a 500 (code-standards rule 6).
 */
export function withRequest<T extends unknown[]>(
  handler: (ctx: RequestContext, ...args: T) => Promise<Response>,
  opts: WithRequestOptions = {},
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    // The id is created on first use, not on entry: a GET handler is prerendered at build time until it reads
    // request data, and Cache Components rejects a random value generated before that point. Every handler
    // reads params, the session or the body before it logs or fails, so the id is always request-time.
    let requestId: RequestId | undefined;
    const bound: LogContext = {};
    const base = opts.logger ?? rootLogger;
    const ctx: RequestContext = {
      get requestId() {
        return (requestId ??= newRequestId());
      },
      get log() {
        return base.child({ requestId: ctx.requestId, ...bound });
      },
      bind(fields) {
        Object.assign(bound, fields);
      },
    };

    try {
      return await handler(ctx, ...args);
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof AppError) {
        const response = errorResponse(err, { requestId: ctx.requestId, headers: opts.headers });
        const code = err instanceof AppError ? err.code : 'VALIDATION';
        ctx.log.warn({ code, status: response.status }, 'request failed');
        return response;
      }
      ctx.log.error({ err }, 'unhandled route error');
      throw err;
    }
  };
}
