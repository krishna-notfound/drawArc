import { createClerkWebhookRoute } from '@/lib/clerk-webhook';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { bindPendingMemberships, removeMembershipsOfDeletedUser } from '@/lib/memberships';

// Public by design (security-model): authenticated by the Svix signature, never by a session.
export const POST = createClerkWebhookRoute({
  db: prisma,
  logger,
  bindPendingMemberships,
  removeMemberships: removeMembershipsOfDeletedUser,
  signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
});
