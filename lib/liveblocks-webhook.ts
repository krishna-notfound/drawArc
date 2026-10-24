import 'server-only';

import { WebhookHandler } from '@liveblocks/node';
import { z } from 'zod';

import type { Logger } from './logger';

// `verifyRequest` checks the signature and timestamp first and only then rejects event types this SDK version
// does not know. Those errors therefore mean "verified, but new": answer 200 so Liveblocks neither retries nor
// disables the endpoint (EC-010).
const UNKNOWN_EVENT = /^Unknown (event type|notification kind)/;

const HandledEvent = z.object({
  type: z.enum(['roomCreated', 'userEntered', 'userLeft', 'storageUpdated']),
  data: z.object({ roomId: z.string(), userId: z.string().nullish() }),
});

export interface LiveblocksWebhookDeps {
  secret: string;
  logger: Logger;
}

/**
 * Verified Liveblocks webhook receiver (FR-015). Public by design: the signature over the raw body is the
 * credential. M1 only logs; the `storageUpdated` snapshot backstop is F13's.
 */
export function createLiveblocksWebhookRoute(deps: LiveblocksWebhookDeps) {
  const handler = new WebhookHandler(deps.secret);

  return async function POST(request: Request): Promise<Response> {
    const rawBody = await request.text();
    const log = deps.logger.child({ requestId: request.headers.get('webhook-id') ?? undefined });

    let event: unknown;
    try {
      event = handler.verifyRequest({ headers: request.headers, rawBody });
    } catch (err) {
      if (err instanceof Error && UNKNOWN_EVENT.test(err.message)) {
        log.info({}, 'liveblocks webhook: unknown event type ignored');
        return Response.json({ received: true });
      }
      log.warn({ reason: err instanceof Error ? err.message.split(',')[0] : 'invalid' }, 'liveblocks webhook rejected');
      return Response.json({ error: { code: 'VALIDATION', message: 'invalid signature' } }, { status: 400 });
    }

    const parsed = HandledEvent.safeParse(event);
    if (parsed.success) {
      const { type, data } = parsed.data;
      log.info({ projectId: data.roomId, userId: data.userId ?? undefined, event: type }, 'liveblocks webhook event');
    }
    return Response.json({ received: true });
  };
}
