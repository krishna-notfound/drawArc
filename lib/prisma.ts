import 'server-only';

import { PrismaNeon } from '@prisma/adapter-neon';

import { env } from './env';
import { PrismaClient } from './generated/prisma/client';

export type { User } from './generated/prisma/client';

// One client per server process. In development, module reloads would otherwise open a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }) });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
