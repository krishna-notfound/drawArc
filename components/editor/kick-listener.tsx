'use client';

import { useRoom, useSelf } from '@liveblocks/react/suspense';

import { useKickListener } from '@/hooks/useKickListener';
import type { ProjectRole } from '@/lib/access';

export { RELOAD_DELAY_MS } from '@/hooks/useKickListener';

export interface KickListenerProps {
  /** The caller's role from the server gate; `checkMyAccess` compares against it after a reconnect (D-032). */
  role: ProjectRole;
  /** Extra hook point fired on every `reconnecting → connected` transition (never on the first connect). */
  onReconnected?: () => void;
}

/**
 * Revocation listener host (F05 FR-013/FR-014), mounted once inside `ProjectRoom`. The behaviour lives in
 * `useKickListener` (F12): KICK / ROLE_CHANGED for me → overlay, unload prompt suppressed, `client.logout()`,
 * full reload; after a reconnect, `checkMyAccess` re-verifies the role.
 */
export function KickListener({ role, onReconnected }: KickListenerProps) {
  const projectId = useRoom().id;
  const currentUserId = useSelf((me) => me.id);
  useKickListener({ projectId, currentUserId, role, onReconnected });
  return null;
}
