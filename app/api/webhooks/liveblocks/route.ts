import { env } from '@/lib/env';
import { createLiveblocksWebhookRoute } from '@/lib/liveblocks-webhook';
import { logger } from '@/lib/logger';

// Public by design (security-model): authenticated by the webhook signature over the raw body, never a session.
export const POST = createLiveblocksWebhookRoute({ secret: env.LIVEBLOCKS_WEBHOOK_SECRET_KEY, logger });
