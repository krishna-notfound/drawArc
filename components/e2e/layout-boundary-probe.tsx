'use client';

import { useSearchParams } from 'next/navigation';

/**
 * E2E-only (F15 AC-012): a render error inside the root layout, outside app/error.tsx, so only
 * app/global-error.tsx can catch it. Mounted by the layout only in builds with test hooks.
 */
export function LayoutBoundaryProbe() {
  if (useSearchParams().get('__f15_throw') === 'layout') throw new Error('E2E boundary probe: layout');
  return null;
}
