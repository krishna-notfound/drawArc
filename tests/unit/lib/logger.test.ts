// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('LOG_LEVEL', undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function lineAt(spy: { mock: { calls: unknown[][] } }, index: number): Record<string, unknown> {
  return JSON.parse(String(spy.mock.calls[index]?.[0])) as Record<string, unknown>;
}

describe('lib/logger (F00 FR-011)', () => {
  it('writes one JSON line with child bindings and context (AC-017)', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { logger } = await import('@/lib/logger');
    logger.child({ requestId: 'r1' }).info({ userId: 'u1', projectId: 'p1' }, 'hello');
    expect(stdout).toHaveBeenCalledTimes(1);
    const line = lineAt(stdout, 0);
    expect(line).toMatchObject({ level: 'info', msg: 'hello', requestId: 'r1', userId: 'u1', projectId: 'p1' });
    expect(new Date(String(line.time)).toISOString()).toBe(line.time);
  });

  it('drops messages below LOG_LEVEL (AC-018, EC-007)', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { logger } = await import('@/lib/logger');
    logger.info({}, 'quiet');
    expect(stdout).not.toHaveBeenCalled();
  });

  it('serialises a non-Error and redacts sensitive keys on stderr (AC-018, EC-008, EC-009)', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { logger } = await import('@/lib/logger');
    logger.error({ err: 'boom', token: 'abc', Authorization: 'Bearer x' }, 'x');
    const line = lineAt(stderr, 0);
    expect(line.err).toEqual({ name: 'NonError', message: 'boom' });
    expect(line.token).toBe('[redacted]');
    expect(line.Authorization).toBe('[redacted]');
  });

  it('serialises an Error with its stack (AC-018)', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { logger } = await import('@/lib/logger');
    logger.error({ err: new Error('e') }, 'y');
    const err = lineAt(stderr, 0).err as Record<string, unknown>;
    expect(err).toMatchObject({ name: 'Error', message: 'e' });
    expect(typeof err.stack).toBe('string');
  });
});
