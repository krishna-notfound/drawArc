// @vitest-environment node
import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createLiveblocksWebhookRoute } from '@/lib/liveblocks-webhook';
import { createFakeLogger } from '@/tests/helpers/fake-logger';

// A test-only signing secret; the route is exercised exactly as Liveblocks would call it (raw body + headers).
const SECRET_BYTES = Buffer.from('f05-test-liveblocks-webhook-secret');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

function signed(payload: unknown, opts: { secret?: Buffer; timestamp?: number } = {}): Request {
  const body = JSON.stringify(payload);
  const id = 'msg_test';
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', opts.secret ?? SECRET_BYTES).update(`${id}.${timestamp}.${body}`).digest('base64');
  return new Request('http://localhost/api/webhooks/liveblocks', {
    method: 'POST',
    headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` },
    body,
  });
}

const userEntered = {
  type: 'userEntered',
  data: { projectId: 'p', roomId: 'cproject', connectionId: 1, userId: 'cuser', userInfo: null, enteredAt: '2026-10-24T00:00:00Z', numActiveUsers: 1 },
};

describe('POST /api/webhooks/liveblocks (F05 AC-018, AC-019)', () => {
  let log: ReturnType<typeof createFakeLogger>;
  let POST: (request: Request) => Promise<Response>;

  beforeEach(() => {
    log = createFakeLogger();
    POST = createLiveblocksWebhookRoute({ secret: SECRET, logger: log });
  });

  const eventLogs = () => log.info.mock.calls.filter(([ctx]) => 'event' in ctx);

  it('accepts a verified event and logs it with the project id', async () => {
    const res = await POST(signed(userEntered));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(eventLogs()).toEqual([[{ projectId: 'cproject', userId: 'cuser', event: 'userEntered' }, expect.any(String)]]);
  });

  it('answers 200 to a verified event type it does not know (EC-010)', async () => {
    const res = await POST(signed({ type: 'somethingNew', data: { roomId: 'cproject' } }));
    expect(res.status).toBe(200);
    expect(eventLogs()).toEqual([]);
  });

  it.each([
    ['a wrong signature', { secret: Buffer.from('another-secret') }],
    ['a stale timestamp', { timestamp: Math.floor(Date.now() / 1000) - 3600 }],
  ])('rejects %s with 400 and logs no event (EC-009)', async (_, opts) => {
    const res = await POST(signed(userEntered, opts));
    expect(res.status).toBe(400);
    expect(eventLogs()).toEqual([]);
  });
});
