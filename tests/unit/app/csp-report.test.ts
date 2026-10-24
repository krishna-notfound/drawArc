// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/csp-report/route';

const report = {
  'csp-report': {
    'document-uri': 'https://drawarc.example/editor',
    'violated-directive': 'connect-src',
    'blocked-uri': 'wss://unknown.example',
  },
};

function send(body: string, contentType = 'application/csp-report'): Promise<Response> {
  return POST(new Request('http://localhost/api/csp-report', { method: 'POST', body, headers: { 'content-type': contentType } }));
}

// The only public, unauthenticated write-shaped route (F15 TC-023): bad input must be a 400, never a 5xx.
describe('POST /api/csp-report (F15 FR-011)', () => {
  it('accepts a browser report with 204', async () => {
    expect((await send(JSON.stringify(report))).status).toBe(204);
  });

  it.each([
    ['a non-JSON body', 'not json'],
    ['a JSON body of the wrong shape', JSON.stringify({ hello: 'world' })],
    ['a body over 8 KB', JSON.stringify({ 'csp-report': { ...report['csp-report'], 'blocked-uri': 'x'.repeat(9_000) } })],
  ])('rejects %s with 400 VALIDATION', async (_label, body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION');
  });
});
