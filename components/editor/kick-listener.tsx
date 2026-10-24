'use client';

import { useClient, useEventListener, useSelf, useStatus } from '@liveblocks/react/suspense';
import { useEffect, useRef } from 'react';

import { publicEnv } from '@/lib/env.public';

import { useUnloadGuard } from './unload-guard';

/** The overlay is visible this long before the reload (FR-013: ≤ 500 ms). */
export const RELOAD_DELAY_MS = 300;

declare global {
  interface Window {
    /** Test hook, only with NEXT_PUBLIC_E2E_HOOKS=1 (spy on `logout` before a forced reload). */
    __liveblocksClient?: ReturnType<typeof useClient>;
  }
}

export interface KickListenerProps {
  /**
   * Hook point fired on every `reconnecting → connected` transition (never on the first connect). F12 passes
   * `checkMyAccess` here to catch KICK/ROLE_CHANGED events missed while offline (D-032); F05 passes nothing.
   */
  onReconnected?: () => void;
}

/**
 * Revocation listener (FR-013, FR-014, security-model "Revocation"). A KICK or ROLE_CHANGED for the current
 * user shows the overlay, suppresses the unload prompt, purges cached tokens with `client.logout()` and fully
 * reloads; the server gate then shows AccessDenied or the auth route issues a token for the new role. Events
 * for other users are ignored. The client never navigates elsewhere itself.
 */
export function KickListener({ onReconnected }: KickListenerProps) {
  const client = useClient();
  const selfId = useSelf((me) => me.id);
  const guard = useUnloadGuard();
  const status = useStatus();
  const previousStatus = useRef(status);
  const onReconnectedRef = useRef(onReconnected);

  useEffect(() => {
    onReconnectedRef.current = onReconnected;
  }, [onReconnected]);

  useEffect(() => {
    if (publicEnv.NEXT_PUBLIC_E2E_HOOKS !== '1') return;
    window.__liveblocksClient = client;
    return () => {
      if (window.__liveblocksClient === client) delete window.__liveblocksClient;
    };
  }, [client]);

  useEffect(() => {
    if (previousStatus.current === 'reconnecting' && status === 'connected') onReconnectedRef.current?.();
    previousStatus.current = status;
  }, [status]);

  useEventListener(({ event }) => {
    if (event.type !== 'KICK' && event.type !== 'ROLE_CHANGED') return;
    if (event.userId !== selfId || guard.isSuppressed()) return;
    guard.showAccessChanged();
    guard.suppress();
    client.logout();
    // Not tied to this component's lifecycle: logout() reconnects the room, which may re-suspend this subtree.
    window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  });

  return null;
}
