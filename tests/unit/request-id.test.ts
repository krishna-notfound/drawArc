// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { AccessError } from '@/lib/errors';
import type { LogContext, Logger } from '@/lib/logger';
import { withRequest } from '@/lib/request-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Line = { level: string; msg: string } & LogContext;

/** A logger that records every line with its bound fields merged in, like the real one. */
function recordingLogger(lines: Line[], bound: LogContext = {}): Logger {
  const write = (level: string) => (ctx: LogContext, msg: string) => lines.push({ level, msg, ...bound, ...ctx });
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (fields) => recordingLogger(lines, { ...bound, ...fields }),
  };
}

describe('withRequest (F15 FR-007)', () => {
  it('answers a typed failure with the standard body and a fresh requestId, logged once with it (AC-009)', async () => {
    const lines: Line[] = [];
    const handler = withRequest(
      async (ctx) => {
        ctx.bind({ userId: 'u1', projectId: 'p1' });
        throw new AccessError('FORBIDDEN');
      },
      { logger: recordingLogger(lines) },
    );

    const response = await handler();
    const body = (await response.json()) as { error: { code: string; message: string; requestId: string } };

    expect(response.status).toBe(403);
    expect(body.error).toEqual({ code: 'FORBIDDEN', message: expect.any(String), requestId: expect.stringMatching(UUID_V4) });
    // Ruling: expected failures log at `warn` (AC-011's level); only unexpected errors log at `error`.
    expect(lines).toEqual([
      expect.objectContaining({ level: 'warn', requestId: body.error.requestId, userId: 'u1', projectId: 'p1', code: 'FORBIDDEN' }),
    ]);
  });

  it('never reuses a requestId across requests (AC-010)', async () => {
    const handler = withRequest(
      async () => {
        throw new AccessError('NOT_FOUND');
      },
      { logger: recordingLogger([]) },
    );
    const ids = await Promise.all(
      [handler(), handler()].map(async (res) => ((await (await res).json()) as { error: { requestId: string } }).error.requestId),
    );
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('logs and rethrows an unexpected error so Next.js handles it as a 500', async () => {
    const lines: Line[] = [];
    const boom = new Error('db down');
    const handler = withRequest(
      async () => {
        throw boom;
      },
      { logger: recordingLogger(lines) },
    );

    await expect(handler()).rejects.toBe(boom);
    expect(lines).toEqual([expect.objectContaining({ level: 'error', requestId: expect.stringMatching(UUID_V4), err: boom })]);
  });
});
