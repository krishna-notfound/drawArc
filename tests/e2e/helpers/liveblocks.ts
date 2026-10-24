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

/** Empties the room's Storage (F13 recovery tests): the room survives, its `flow` subtree is gone. */
export function clearRoomStorage(projectId: string): Promise<void> {
  return testLiveblocks().deleteStorageDocument(projectId);
}

/** Node and edge ids in the room's React Flow subtree (`{ flow: { nodes: { [id] }, edges: { [id] } } }`). */
export async function roomFlowIds(projectId: string): Promise<{ nodes: string[]; edges: string[] }> {
  const storage = (await testLiveblocks().getStorageDocument(projectId, 'json')) as {
    flow?: { nodes?: Record<string, unknown>; edges?: Record<string, unknown> };
  };
  return { nodes: Object.keys(storage.flow?.nodes ?? {}), edges: Object.keys(storage.flow?.edges ?? {}) };
}

/** True when the room's `flow` subtree is stored as Live structures (what `useLiveblocksFlow` can mutate). */
export async function roomFlowIsLive(projectId: string): Promise<boolean> {
  const lson = (await testLiveblocks().getStorageDocument(projectId, 'plain-lson')) as {
    data?: { flow?: { liveblocksType?: string; data?: { nodes?: { liveblocksType?: string } } } };
  };
  const flow = lson.data?.flow;
  return flow?.liveblocksType === 'LiveObject' && flow.data?.nodes?.liveblocksType === 'LiveMap';
}
