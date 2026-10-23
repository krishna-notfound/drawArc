// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SERVICE_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'DATABASE_URL_TEST',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
  'LIVEBLOCKS_SECRET_KEY',
  'LIVEBLOCKS_WEBHOOK_SECRET_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'TRIGGER_SECRET_KEY',
] as const;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  SERVICE_KEYS.forEach((key) => vi.stubEnv(key, undefined));
  vi.stubEnv('LOG_LEVEL', undefined);
});

describe('lib/env (F00 FR-003)', () => {
  it('loads with no service keys set (AC-003)', async () => {
    const { env } = await import('@/lib/env');
    expect(env.NODE_ENV).toBe('test');
    expect(env.LOG_LEVEL).toBe('info');
    SERVICE_KEYS.forEach((key) => expect(env[key]).toBeUndefined());
  });

  it('rejects a malformed key and names it without leaking the value (AC-004)', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'notaprefix');
    const error = await import('@/lib/env').then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toContain('CLERK_SECRET_KEY');
    expect(error?.message).not.toContain('notaprefix');
  });

  it('treats an empty string as unset', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    const { env } = await import('@/lib/env');
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
  });

  it('honours an explicit LOG_LEVEL', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { env } = await import('@/lib/env');
    expect(env.LOG_LEVEL).toBe('warn');
  });
});
