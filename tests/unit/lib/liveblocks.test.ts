// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_COLORS } from '@/types/liveblocks.config';

const sdk = vi.hoisted(() => ({
  getOrCreateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  broadcastEvent: vi.fn(),
}));
const log = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock('@liveblocks/node', () => ({
  Liveblocks: vi.fn(function Liveblocks() {
    return sdk;
  }),
}));
vi.mock('@/lib/logger', () => ({ logger: log }));

const { deleteRoom, ensureRoom, getLiveblocks, kickUser, notifyRoleChanged, userColor } = await import('@/lib/liveblocks');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('userColor (F05 AC-004)', () => {
  it('maps ids deterministically onto USER_COLORS without one colour dominating', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `c${i.toString(36).padStart(8, '0')}${Math.random().toString(36).slice(2, 18)}`);
    const counts = new Map<string, number>();
    for (const id of ids) {
      const color = userColor(id);
      expect(userColor(id)).toBe(color);
      expect(USER_COLORS).toContain(color);
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(250);
  });
});

describe('lib/liveblocks helpers (F05 AC-003)', () => {
  it('caches one node client', () => {
    expect(getLiveblocks()).toBe(getLiveblocks());
  });

  it('kickUser / notifyRoleChanged retry once and report delivery without throwing', async () => {
    sdk.broadcastEvent.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined);
    await expect(kickUser('cproject', 'cuser')).resolves.toBe(true);
    expect(sdk.broadcastEvent).toHaveBeenLastCalledWith('cproject', { type: 'KICK', userId: 'cuser' });

    sdk.broadcastEvent.mockClear().mockRejectedValue(new Error('down'));
    await expect(notifyRoleChanged('cproject', 'cuser', 'viewer')).resolves.toBe(false);
    expect(sdk.broadcastEvent).toHaveBeenCalledTimes(2);
    expect(sdk.broadcastEvent).toHaveBeenCalledWith('cproject', { type: 'ROLE_CHANGED', userId: 'cuser', role: 'viewer' });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'cproject', userId: 'cuser', op: 'notifyRoleChanged' }),
      expect.any(String),
    );
  });

  it('ensureRoom / deleteRoom swallow SDK failures and log the project id (EC-015)', async () => {
    sdk.getOrCreateRoom.mockRejectedValue(new Error('down'));
    sdk.deleteRoom.mockRejectedValue(new Error('down'));
    await expect(ensureRoom('cproject')).resolves.toBeUndefined();
    await expect(deleteRoom('cproject')).resolves.toBeUndefined();
    expect(sdk.getOrCreateRoom).toHaveBeenCalledWith('cproject', { defaultAccesses: [] });
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'cproject', op: 'ensureRoom' }), expect.any(String));
  });
});
