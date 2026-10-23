import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load env files itself; Next.js keeps local values in .env.local.
config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // The CLI (migrate, validate) uses the direct connection. `process.env` rather than Prisma's `env()`
  // because `env()` throws when the key is unset, and `prisma generate` (postinstall, CI) needs no database.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? '' },
});
