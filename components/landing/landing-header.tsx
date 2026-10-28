import Link from 'next/link';

import { cn } from '@/lib/utils';

import { LANDING_COPY } from './copy';
import { SessionCta } from './session-cta';

// Shared with the footer links; it lives here, not in `session-cta.tsx`, whose exports are client references.
export const FOCUS_RING = 'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand';

export function LandingHeader(): React.JSX.Element {
  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-border px-4 sm:px-8">
      <Link href="/" className={cn('text-lg font-semibold text-brand', FOCUS_RING)}>
        {LANDING_COPY.wordmark}
      </Link>
      <nav aria-label="Primary">
        <SessionCta variant="header" />
      </nav>
    </header>
  );
}
