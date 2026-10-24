import { createClerkWebhookRoute } from '@/lib/clerk-webhook';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { bindPendingMemberships } from '@/lib/users';

// Public by design (security-model): authenticated by the Svix signature, never by a session.
export const POST = createClerkWebhookRoute({
  db: prisma,
  logger,
  bindPendingMemberships,
  signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
});
