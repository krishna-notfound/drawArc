'use client';

import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

import type { SeedResult } from '@/lib/liveblocks-flow';

export const SEED_WARNING_COPY = {
  SEED_FAILED: "The saved diagram couldn't be restored right now. It will be retried the next time this project is opened.",
  SNAPSHOT_INVALID: 'The saved diagram could not be restored (invalid snapshot).',
} as const;

/** Dismissible notice over the canvas when the gate's seed step failed (F13 FR-016, P-13-8). */
export function SeedWarningBanner({ warning }: { warning: SeedResult['warning'] }) {
  const [dismissed, setDismissed] = useState(false);
  if (!warning || dismissed) return null;
  return (
    <div
      role="status"
      data-slot="seed-warning"
      className="fixed top-17 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-surface-border bg-elevated px-3 py-2 text-xs text-copy-muted shadow-lg"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span>{SEED_WARNING_COPY[warning]}</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded-md text-copy-muted hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        onClick={() => setDismissed(true)}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
