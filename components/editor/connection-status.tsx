'use client';

import { useLostConnectionListener, useRoom, useStatus, useSyncStatus } from '@liveblocks/react/suspense';
import { CloudUpload, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export const CONNECTION_TOASTS = {
  lost: "Connection lost — your changes will sync when you're back online",
  restored: 'Connection restored',
  failed: 'Could not reconnect. Reload the page.',
} as const;

type PillState = 'reconnecting' | 'disconnected' | 'syncing' | null;

function pillState(status: ReturnType<typeof useStatus>, sync: ReturnType<typeof useSyncStatus>): PillState {
  if (status === 'reconnecting' || status === 'connecting') return 'reconnecting';
  if (status === 'disconnected') return 'disconnected';
  if (sync === 'synchronizing') return 'syncing';
  return null;
}

/**
 * Connection pill and lost-connection toasts (FR-011, PRD-032). Hidden while connected and synchronised;
 * every state is text plus icon, never colour alone. Spinners only animate without reduced motion.
 */
export function ConnectionStatus() {
  const room = useRoom();
  const status = useStatus();
  const sync = useSyncStatus({ smooth: true });

  useLostConnectionListener((event) => {
    if (event === 'lost') toast.warning(CONNECTION_TOASTS.lost);
    else if (event === 'restored') toast.success(CONNECTION_TOASTS.restored);
    else toast.error(CONNECTION_TOASTS.failed, { action: { label: 'Reload the page', onClick: () => window.location.reload() } });
  });

  const state = pillState(status, sync);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute top-3 right-3 z-10">
      {state ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-surface-border bg-elevated px-3 py-1.5 text-xs">
          {state === 'reconnecting' ? (
            <>
              <Loader2 className="size-3.5 text-warning motion-safe:animate-spin" aria-hidden="true" />
              <span className="text-warning">Reconnecting…</span>
            </>
          ) : null}
          {state === 'disconnected' ? (
            <>
              <WifiOff className="size-3.5 text-error" aria-hidden="true" />
              <span className="text-error">Disconnected</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => room.reconnect()}>
                Retry
              </Button>
            </>
          ) : null}
          {state === 'syncing' ? (
            <>
              <CloudUpload className="size-3.5 text-copy-muted" aria-hidden="true" />
              <span className="text-copy-muted">Syncing…</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
