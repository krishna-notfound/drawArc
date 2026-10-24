// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Activated by F02 (FR-007) and F05 (FR-016): required at boot. The rest stay optional until their feature.
const REQUIRED_SERVER_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
  'LIVEBLOCKS_SECRET_KEY',
  'LIVEBLOCKS_WEBHOOK_SECRET_KEY',
] as const;
const OPTIONAL_SERVER_KEYS = [
  'DATABASE_URL_TEST',
  'TRIGGER_SECRET_KEY',
] as const;
const VALID: Record<(typeof REQUIRED_SERVER_KEYS)[number], string> = {
  DATABASE_URL: 'postgresql://user:pw@db.example.test/app',
  DATABASE_URL_UNPOOLED: 'postgresql://user:pw@db-direct.example.test/app',
  CLERK_SECRET_KEY: 'sk_test_value',
  CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_value',
  LIVEBLOCKS_SECRET_KEY: 'sk_dev_value',
  LIVEBLOCKS_WEBHOOK_SECRET_KEY: 'whsec_value',
};

async function importError(path: string): Promise<Error | null> {
  return import(path).then(
    () => null,
    (e: unknown) => e as Error,
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  REQUIRED_SERVER_KEYS.forEach((key) => vi.stubEnv(key, VALID[key]));
  OPTIONAL_SERVER_KEYS.forEach((key) => vi.stubEnv(key, undefined));
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_value');
  vi.stubEnv('VERCEL', undefined);
  vi.stubEnv('LOG_LEVEL', undefined);
});

describe('lib/env (F00 FR-003, F02 FR-007)', () => {
  it('loads with the activated keys set and later-feature keys unset', async () => {
    const { env } = await import('@/lib/env');
    expect(env.NODE_ENV).toBe('test');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CLERK_SECRET_KEY).toBe(VALID.CLERK_SECRET_KEY);
    OPTIONAL_SERVER_KEYS.forEach((key) => expect(env[key]).toBeUndefined());
  });

  it.each(REQUIRED_SERVER_KEYS)('fails fast naming %s when it is missing or empty (F02 AC-010, EC-011)', async (key) => {
    vi.stubEnv(key, '');
    const error = await importError('@/lib/env');
    expect(error?.message).toContain(key);
  });

  it('fails naming NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY when it is missing (F02 AC-010)', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', undefined);
    const error = await importError('@/lib/env.public');
    expect(error?.message).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });

  it('rejects a malformed key and names it without leaking the value (F00 AC-004)', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'notaprefix');
    const error = await importError('@/lib/env');
    expect(error?.message).toContain('CLERK_SECRET_KEY');
    expect(error?.message).not.toContain('notaprefix');
  });

  it('rejects a Liveblocks public key in LIVEBLOCKS_SECRET_KEY (F05 AC-020)', async () => {
    vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'pk_x');
    expect((await importError('@/lib/env'))?.message).toContain('LIVEBLOCKS_SECRET_KEY');
  });

  it('requires BLOB_READ_WRITE_TOKEN off Vercel and not on Vercel, where OIDC is used (F13 AC-001)', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', undefined);
    expect((await importError('@/lib/env'))?.message).toContain('BLOB_READ_WRITE_TOKEN');
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    expect(await importError('@/lib/env')).toBeNull();
  });

  it('honours an explicit LOG_LEVEL', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { env } = await import('@/lib/env');
    expect(env.LOG_LEVEL).toBe('warn');
  });
});
