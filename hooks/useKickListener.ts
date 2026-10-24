'use client';

import { useClient, useEventListener, useRoom, useSelf, useStatus } from '@liveblocks/react/suspense';
import { useCallback, useEffect, useRef, useState } from 'react';

import { checkMyAccess } from '@/app/editor/[projectId]/actions';
import { useUnloadGuard } from '@/components/editor/unload-guard';
import type { ProjectRole } from '@/lib/access';
import { publicEnv } from '@/lib/env.public';

/** The overlay is visible this long before the reload (FR-014: ≤ 500 ms). */
export const RELOAD_DELAY_MS = 300;

declare global {
  interface Window {
    /** Test hook, only with NEXT_PUBLIC_E2E_HOOKS=1 (spy on `logout` before a forced reload). */
    __liveblocksClient?: ReturnType<typeof useClient>;
  }
}

export interface UseKickListenerArgs {
  projectId: string;
  currentUserId: string;
  /** The role the page was rendered with; a different role on reconnect means the token is stale. */
  role: ProjectRole;
  /** Extra hook point fired after every `reconnecting → connected` transition (F05). */
  onReconnected?: () => void;
}

/**
 * Revocation listener (F05 FR-013/FR-014, F12 FR-014–FR-016, D-031, D-032). A KICK or ROLE_CHANGED for the
 * current user — or, after a reconnect, a `checkMyAccess` result that no longer matches `role` — shows the
 * overlay, suppresses the unload prompt, purges cached tokens with `client.logout()` and fully reloads. The
 * server gate then shows AccessDenied, or the auth route issues a token for the new role. Events for other
 * users are ignored; the client never navigates elsewhere itself.
 */
export function useKickListener({ projectId, currentUserId, role, onReconnected }: UseKickListenerArgs): { kicked: boolean } {
  const client = useClient();
  const guard = useUnloadGuard();
  const status = useStatus();
  const [kicked, setKicked] = useState(false);
  const previousStatus = useRef(status);
  const latest = useRef({ projectId, role, onReconnected });

  useEffect(() => {
    latest.current = { projectId, role, onReconnected };
  }, [projectId, role, onReconnected]);

  useEffect(() => {
    if (publicEnv.NEXT_PUBLIC_E2E_HOOKS !== '1') return;
    window.__liveblocksClient = client;
    return () => {
      if (window.__liveblocksClient === client) delete window.__liveblocksClient;
    };
  }, [client]);

  const eject = useCallback(() => {
    if (guard.isSuppressed()) return;
    setKicked(true);
    guard.showAccessChanged();
    guard.suppress();
    client.logout();
    // Not tied to this component's lifecycle: logout() reconnects the room, which may re-suspend this subtree.
    window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  }, [client, guard]);

  useEffect(() => {
    const reconnected = previousStatus.current === 'reconnecting' && status === 'connected';
    previousStatus.current = status;
    if (!reconnected) return;
    const { projectId: id, role: expected, onReconnected: extra } = latest.current;
    extra?.();
    // A KICK/ROLE_CHANGED may have been missed while offline (EC-010). A failed request (still offline) is
    // ignored: the next reconnect checks again.
    checkMyAccess({ projectId: id }).then(
      (result) => {
        if (!result.ok || result.data.role !== expected) eject();
      },
      () => undefined,
    );
  }, [status, eject]);

  useEventListener(({ event }) => {
    if (event.type !== 'KICK' && event.type !== 'ROLE_CHANGED') return;
    if (event.userId === currentUserId) eject();
  });

  return { kicked };
}

/** `useKickListener` for the current room and the connected user (what `KickListener` hosts). */
export function useRoomKickListener({ role, onReconnected }: Pick<UseKickListenerArgs, 'role' | 'onReconnected'>): { kicked: boolean } {
  const projectId = useRoom().id;
  const selfId = useSelf((me) => me.id);
  return useKickListener({ projectId, currentUserId: selfId, role, onReconnected });
}
