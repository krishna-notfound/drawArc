import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('gridStore (F10 v2 TC-037)', () => {
  it('defaults off, persists "1" in localStorage, and notifies subscribers (FR-019)', async () => {
    localStorage.clear();
    vi.resetModules();
    const { gridStore, GRID_STORAGE_KEY } = await import('@/lib/canvas/preferences'); // fresh module per case
    const cb = vi.fn();
    const off = gridStore.subscribe(cb);
    expect(gridStore.get()).toBe(false);
    gridStore.set(true);
    expect(cb).toHaveBeenCalledOnce();
    expect(localStorage.getItem(GRID_STORAGE_KEY)).toBe('1');
    gridStore.set(false);
    expect(localStorage.getItem(GRID_STORAGE_KEY)).toBeNull();
    off();
  });

  it('reads an existing "1" at load and keeps working when localStorage throws (EC-023, AC-035)', async () => {
    localStorage.setItem('drawarc.grid', '1');
    vi.resetModules();
    expect((await import('@/lib/canvas/preferences')).gridStore.get()).toBe(true);
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { gridStore } = await import('@/lib/canvas/preferences');
    expect(gridStore.get()).toBe(false);
    expect(() => gridStore.set(true)).not.toThrow();
    expect(gridStore.get()).toBe(true);
  });
});
