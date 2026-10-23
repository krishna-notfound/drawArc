import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { PrismaNeon } from '@prisma/adapter-neon';
import { parse } from 'dotenv';

import { PrismaClient } from '@/lib/generated/prisma/client';

/**
 * L2 database: `DATABASE_URL_TEST` from the shell, else from .env.local (only that key is read).
 * It must be a direct (unpooled) Neon URL; an optional `schema=` parameter isolates the suite in its own
 * Postgres schema. Without it, L2 suites skip (CI has no database).
 */
function resolveTestDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  try {
    return parse(readFileSync('.env.local')).DATABASE_URL_TEST || undefined;
  } catch {
    return undefined;
  }
}

export const testDatabaseUrl = resolveTestDatabaseUrl();
export const hasTestDatabase = testDatabaseUrl !== undefined;
/** The Postgres schema the suite runs in (`public` unless the URL names one). */
export const testSchema = testDatabaseUrl ? (new URL(testDatabaseUrl).searchParams.get('schema') ?? 'public') : 'public';

/** Applies committed migrations to the test database (Prisma's advisory lock makes parallel calls safe). */
export function migrateTestDatabase(): void {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL_UNPOOLED: testDatabaseUrl },
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
}

/** A client on the test database. The `schema` URL parameter is handed to the adapter, not the driver. */
export function createTestPrisma(): PrismaClient {
  if (!testDatabaseUrl) throw new Error('DATABASE_URL_TEST is not set');
  const url = new URL(testDatabaseUrl);
  url.searchParams.delete('schema');
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url.toString() }, { schema: testSchema }) });
}
