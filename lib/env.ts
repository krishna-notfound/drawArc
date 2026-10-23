import 'server-only';

import { z } from 'zod';

import { parseEnv } from './env.public';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Service keys stay optional until the feature that installs the service activates them (D-F00-1).
export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  DATABASE_URL: z.url().optional(), // F02 activates
  DATABASE_URL_UNPOOLED: z.url().optional(), // F02 activates
  DATABASE_URL_TEST: z.url().optional(), // L2 tests only
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(), // F02 activates
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().startsWith('whsec_').optional(), // F02 activates
  LIVEBLOCKS_SECRET_KEY: z.string().startsWith('sk_').optional(), // F05 activates
  LIVEBLOCKS_WEBHOOK_SECRET_KEY: z.string().startsWith('whsec_').optional(), // F05 activates
  BLOB_READ_WRITE_TOKEN: z.string().optional(), // F13 (local/CI only; OIDC on Vercel)
  TRIGGER_SECRET_KEY: z.string().optional(), // M2 (F17)
});

export type ServerEnv = Omit<z.infer<typeof ServerEnvSchema>, 'LOG_LEVEL'> & { LOG_LEVEL: LogLevel };

const parsed = parseEnv(ServerEnvSchema, process.env, 'server');

export const env: ServerEnv = {
  ...parsed,
  LOG_LEVEL: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === 'development' ? 'debug' : 'info'),
};

export { publicEnv } from './env.public';
