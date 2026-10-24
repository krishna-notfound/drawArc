import 'server-only';

import { Liveblocks } from '@liveblocks/node';

import type { KickEvent, RoleChangedEvent } from '@/types/liveblocks.config';

import { env, publicEnv } from './env';
import { logger } from './logger';

export { userColor } from './user-color';

const globalForLiveblocks = globalThis as unknown as { liveblocks?: Liveblocks };

/** The one node client (FR-003); cached on `globalThis` so dev hot reloads do not create new ones. */
export function getLiveblocks(): Liveblocks {
  globalForLiveblocks.liveblocks ??= new Liveblocks({
    secret: env.LIVEBLOCKS_SECRET_KEY,
    // The local dev server (tests only) serves the browser and the node client from the same URL.
    ...(publicEnv.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL ? { baseUrl: publicEnv.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL } : {}),
  });
  return globalForLiveblocks.liveblocks;
}

/**
 * Creates room metadata for a new project (P-05-3). No default access: every connection needs a token minted
 * by /api/liveblocks-auth. Best effort: rooms also auto-create on first join, so failures are only logged.
 */
export async function ensureRoom(projectId: string): Promise<void> {
  try {
    await getLiveblocks().getOrCreateRoom(projectId, { defaultAccesses: [] });
  } catch (err) {
    logger.error({ projectId, op: 'ensureRoom', err }, 'liveblocks ensureRoom failed');
  }
}

/** Deletes the project's room (invariant 7). The SDK does not throw for a missing room; other failures are logged. */
export async function deleteRoom(projectId: string): Promise<void> {
  try {
    await getLiveblocks().deleteRoom(projectId);
  } catch (err) {
    logger.error({ projectId, op: 'deleteRoom', err }, 'liveblocks deleteRoom failed');
  }
}

async function broadcastWithRetry(
  projectId: string,
  event: KickEvent | RoleChangedEvent,
  ctx: { userId: string; op: 'kickUser' | 'notifyRoleChanged' },
): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await getLiveblocks().broadcastEvent(projectId, event);
      return true;
    } catch (err) {
      if (attempt === 2) logger.error({ projectId, ...ctx, err }, 'liveblocks broadcast failed');
    }
  }
  return false;
}

/**
 * Tells a removed member's open sessions to leave (security-model "Revocation"). Retries once; `false` means
 * the event was not delivered (F12 surfaces it as `kickDelivered`). Never throws.
 */
export function kickUser(projectId: string, userId: string): Promise<boolean> {
  return broadcastWithRetry(projectId, { type: 'KICK', userId }, { userId, op: 'kickUser' });
}

/** Tells a member's open sessions to re-authenticate with their new role (P-05-2). Same semantics as `kickUser`. */
export function notifyRoleChanged(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<boolean> {
  return broadcastWithRetry(projectId, { type: 'ROLE_CHANGED', userId, role }, { userId, op: 'notifyRoleChanged' });
}
