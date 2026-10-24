import { expect, test } from '@playwright/test';

// F15 FR-011 (AC-019): runs against the local stack and, in the preview project, against the deployment.
for (const path of ['/', '/editor']) {
  test(`${path} carries the security headers and the report-only CSP (AC-019)`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['content-security-policy-report-only']).toContain("img-src 'self' https://img.clerk.com");
    expect(headers['content-security-policy-report-only']).toContain('report-uri /api/csp-report');
    // Report-only for all of M1 (F15-D2): nothing is enforced yet.
    expect(headers['content-security-policy']).toBeUndefined();
  });
}
