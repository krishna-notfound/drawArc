import { z } from 'zod';

import { AppError } from '@/lib/errors';
import { withRequest } from '@/lib/request-id';

/** Reports are small; anything larger is not a browser report (F15 TC-023). */
const MAX_REPORT_BYTES = 8 * 1024;
const FIELD_MAX = 512;

const field = z.string().transform((value) => value.slice(0, FIELD_MAX));

// The minimal `report-uri` shape (`application/csp-report`); unknown keys are dropped, never logged.
const CspReport = z.object({
  'csp-report': z.object({
    'document-uri': field,
    'violated-directive': field,
    'blocked-uri': field.optional(),
    'effective-directive': field.optional(),
    'source-file': field.optional(),
    'line-number': z.number().int().optional(),
  }),
});

/**
 * CSP report sink (F15 FR-011, F15-D2). Public by design: browsers send reports without credentials. Its only
 * effect is one `warn` log line; bad input is a 400, never a 5xx. Flooding is left to Vercel's firewall.
 */
export const POST = withRequest(async (ctx, request: Request) => {
  if (Number(request.headers.get('content-length') ?? '0') > MAX_REPORT_BYTES) {
    throw new AppError('VALIDATION', 'Report too large.');
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_REPORT_BYTES) throw new AppError('VALIDATION', 'Report too large.');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('VALIDATION', 'Malformed report.');
  }
  const parsed = CspReport.safeParse(raw);
  if (!parsed.success) throw new AppError('VALIDATION', 'Malformed report.');

  ctx.log.warn({ report: parsed.data['csp-report'] }, 'csp.violation');
  return new Response(null, { status: 204 });
});
