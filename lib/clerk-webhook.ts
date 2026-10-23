import 'server-only';

import { verifyWebhook, type WebhookEvent } from '@clerk/nextjs/webhooks';
import { type NextRequest, NextResponse } from 'next/server';

import { ClerkDeletedSchema, ClerkWebhookUserSchema } from '@/schemas/clerk';

import type { AuthUser } from './auth';
import { httpStatusFor } from './errors';
import type { Logger } from './logger';
import { EmailConflictError, mapWebhookUser, markUserDeleted, toAuthUser, type UserDb, upsertUserFromClerk } from './users';

export type ClerkEventResult = {
  handled: boolean;
  reason?: 'unknown-type' | 'no-email' | 'missing-id' | 'invalid-payload' | 'email-conflict';
};

export interface ClerkEventDeps {
  db: UserDb;
  logger: Logger;
  bindPendingMemberships: (user: AuthUser) => Promise<{ bound: number }>;
}

/**
 * Applies a verified Clerk event. Every write is an upsert keyed by `clerkId`, so Svix retries and
 * out-of-order deliveries converge (EC-004/005). Results with `handled: false` are answered 200: a retry
 * cannot change them. Database failures throw so the route answers non-2xx and Svix retries.
 */
export async function handleClerkEvent(evt: WebhookEvent, deps: ClerkEventDeps): Promise<ClerkEventResult> {
  const { db, logger } = deps;
  switch (evt.type) {
    case 'user.created':
    case 'user.updated': {
      const parsed = ClerkWebhookUserSchema.safeParse(evt.data);
      if (!parsed.success) {
        const missingId = parsed.error.issues.some((issue) => issue.path[0] === 'id');
        logger.warn({ type: evt.type, issues: parsed.error.issues.map((i) => i.path.join('.')) }, 'clerk webhook payload rejected');
        return { handled: false, reason: missingId ? 'missing-id' : 'invalid-payload' };
      }
      const input = mapWebhookUser(parsed.data);
      if (!input) {
        logger.warn({ type: evt.type, clerkId: parsed.data.id }, 'clerk user has no email; not synced');
        return { handled: false, reason: 'no-email' };
      }
      try {
        const row = await upsertUserFromClerk(db, input);
        if (!row.deletedAt) await deps.bindPendingMemberships(toAuthUser(row));
      } catch (err) {
        if (!(err instanceof EmailConflictError)) throw err;
        logger.error(
          { type: evt.type, clerkId: err.clerkId, conflictingClerkId: err.conflictingClerkId },
          'clerk webhook: email already belongs to another user; needs manual reconciliation',
        );
        return { handled: false, reason: 'email-conflict' };
      }
      return { handled: true };
    }
    case 'user.deleted': {
      const parsed = ClerkDeletedSchema.safeParse(evt.data);
      const clerkId = parsed.success ? parsed.data.id : undefined;
      if (!clerkId) {
        logger.warn({ type: evt.type }, 'clerk user.deleted without an id');
        return { handled: false, reason: 'missing-id' };
      }
      // Membership removal for deleted users is owed by F03/F12 once ProjectMember exists.
      await markUserDeleted(db, clerkId);
      return { handled: true };
    }
    default:
      return { handled: false, reason: 'unknown-type' };
  }
}

export interface ClerkWebhookRouteDeps extends ClerkEventDeps {
  signingSecret: string;
}

/** The `POST /api/webhooks/clerk` handler: authenticate (Svix signature) → validate → act. */
export function createClerkWebhookRoute(deps: ClerkWebhookRouteDeps) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = request.headers.get('svix-id') ?? undefined;
    const log = deps.logger.child({ requestId });

    let evt: WebhookEvent;
    try {
      evt = await verifyWebhook(request, { signingSecret: deps.signingSecret });
    } catch (err) {
      log.warn({ err }, 'clerk webhook signature rejected');
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Invalid webhook signature' } },
        { status: httpStatusFor('VALIDATION') },
      );
    }

    try {
      const result = await handleClerkEvent(evt, { ...deps, logger: log });
      log.info({ type: evt.type, ...result }, 'clerk webhook processed');
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      log.error({ type: evt.type, err }, 'clerk webhook failed; Svix will retry');
      return NextResponse.json(
        { error: { code: 'UPSTREAM', message: 'Could not process the event.' } },
        { status: httpStatusFor('UPSTREAM') },
      );
    }
  };
}
