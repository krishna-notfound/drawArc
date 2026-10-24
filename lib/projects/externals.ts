import 'server-only';

import { deleteCanvas } from '@/lib/blob';
import { deleteRoom, ensureRoom, kickUser } from '@/lib/liveblocks';

/**
 * Side effects of the project lifecycle in systems Postgres does not own (D-025). Project actions call
 * these instead of the Liveblocks/Blob SDKs, so F03 is testable on its own. F05 wires `ensureRoom`,
 * `deleteRoom` and `kickUsers`; F13 wires `deleteSnapshot`. Callers treat every method as best-effort.
 */
export interface ProjectExternals {
  /** F05: `liveblocks.getOrCreateRoom(id, { defaultAccesses: [] })`. */
  ensureRoom(projectId: string): Promise<void>;
  /** F05: `liveblocks.deleteRoom(id)`. */
  deleteRoom(projectId: string): Promise<void>;
  /** F05: broadcast `{ type: 'KICK', userId }` per id so connected clients leave before the room goes. */
  kickUsers(projectId: string, userIds: string[]): Promise<void>;
  /** F13: Blob `del(canvas/{id}.json)`. */
  deleteSnapshot(projectId: string): Promise<void>;
}

export const defaultExternals: ProjectExternals = {
  ensureRoom,
  deleteRoom,
  // kickUser never throws and logs its own failures; the delete action goes on to delete the room either way.
  kickUsers: async (projectId, userIds) => {
    await Promise.all(userIds.map((userId) => kickUser(projectId, userId)));
  },
  deleteSnapshot: deleteCanvas,
};
