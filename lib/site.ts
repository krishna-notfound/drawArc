import { publicEnv } from './env.public';

export const SITE_NAME = 'drawArc';

export const SITE_DESCRIPTION =
  'Real-time collaborative system-design canvas and whiteboard. Sketch architectures with shapes, connectors and text, and edit them live with your team.';

/**
 * Open Graph image colours. Satori cannot read CSS variables, so these mirror `--bg-base`, `--text-primary` and
 * `--accent-primary` in `app/globals.css`; `tests/unit/app/landing-metadata.test.ts` fails when they drift.
 */
export const OG_THEME = {
  background: '#080809',
  text: '#f0f0f4',
  brand: '#00c8d4',
} as const;

/** Canonical origin without a trailing slash; `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset. */
export function siteUrl(): string {
  return (publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
