'use client';

import { useSyncExternalStore } from 'react';

import { gridStore } from '@/lib/canvas/preferences';

const serverSnapshot = () => false;

/** Whether this user has the 20 px grid on (per browser, `localStorage`; off on the server and until toggled). */
export function useGrid(): boolean {
  return useSyncExternalStore(gridStore.subscribe, gridStore.get, serverSnapshot);
}
