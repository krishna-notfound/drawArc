import { Liveblocks } from '@liveblocks/node';

/**
 * Node client for test set-up and clean-up: the local dev server with E2E_LIVEBLOCKS=1 (it accepts only
 * `sk_localdev`), otherwise the Liveblocks project in LIVEBLOCKS_SECRET_KEY (the development project locally).
 */
export function testLiveblocks(): Liveblocks {
  if (process.env.E2E_LIVEBLOCKS === '1') return new Liveblocks({ secret: 'sk_localdev', baseUrl: 'http://localhost:1153' });
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) throw new Error('LIVEBLOCKS_SECRET_KEY is not set');
  return new Liveblocks({ secret });
}

export function kickUser(projectId: string, userId: string): Promise<void> {
  return testLiveblocks().broadcastEvent(projectId, { type: 'KICK', userId });
}

export function notifyRoleChanged(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
  return testLiveblocks().broadcastEvent(projectId, { type: 'ROLE_CHANGED', userId, role });
}

/** Removes the room the spec's project created; a missing room does not throw. */
export function deleteRoom(projectId: string): Promise<void> {
  return testLiveblocks().deleteRoom(projectId);
}
