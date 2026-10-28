import type { SnapGrid } from '@xyflow/react';

/**
 * Per-user canvas preferences (F10 v2 FR-019, D-10i). The grid flag lives only in this browser's `localStorage`:
 * never in Liveblocks Storage, never in the database, no history entry. The in-memory value is the truth, so a
 * private window or a full quota (where `localStorage` throws) still toggles for the session (EC-023). Pure: no React.
 */
export const GRID_STORAGE_KEY = 'drawarc.grid';
export const GRID_SIZE = 20;
/** One module constant: a stable identity, so React Flow never sees a new `snapGrid` per render. */
export const SNAP_GRID: SnapGrid = [GRID_SIZE, GRID_SIZE];

function readInitial(): boolean {
  try {
    return localStorage.getItem(GRID_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let current = readInitial();
const listeners = new Set<() => void>();

export const gridStore = {
  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
  get(): boolean {
    return current;
  },
  set(value: boolean): void {
    current = value;
    for (const listener of [...listeners]) listener();
    try {
      if (value) localStorage.setItem(GRID_STORAGE_KEY, '1');
      else localStorage.removeItem(GRID_STORAGE_KEY);
    } catch {
      // Unavailable or full: the preference lasts for this session only.
    }
  },
};
