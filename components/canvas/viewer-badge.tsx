'use client';

import { useStatus, useSyncStatus } from '@liveblocks/react/suspense';
import { Eye } from 'lucide-react';

import { pillState } from '@/components/editor/connection-status';
import { cn } from '@/lib/utils';

/**
 * Muted "View only" pill for read-only members (FR-012). It shares the connection pill's top-right corner (the
 * canvas is full-viewport, so 4.25rem = navbar + the pill's offset) and steps below it while the pill shows.
 */
export function ViewerBadge() {
  const pillVisible = pillState(useStatus(), useSyncStatus({ smooth: true })) !== null;
  return (
    <div
      data-slot="viewer-badge"
      className={cn(
        'pointer-events-none absolute right-3 z-10 flex items-center gap-1.5 rounded-xl border border-surface-border bg-elevated px-3 py-1.5 text-xs text-copy-muted',
        pillVisible ? 'top-27' : 'top-17',
      )}
    >
      <Eye className="size-3.5" aria-hidden="true" />
      View only
    </div>
  );
}
