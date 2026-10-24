'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import type { AutosaveState } from '@/hooks/useAutosave';
import type { ProjectRole } from '@/lib/access';
import type { SeedResult } from '@/lib/liveblocks-flow';

export const NO_SEED: SeedResult = { seeded: false, snapshotExists: false, savedAt: null, warning: null };

/** Until the canvas mounts its autosave (room still connecting), the Save button shows a disabled "Save". */
const UNMOUNTED: AutosaveState = { status: 'idle', lastSavedAt: null, lastError: null, save: async () => 'busy' };

interface SaveContextValue {
  role: ProjectRole;
  seed: SeedResult;
  autosave: AutosaveState | null;
  setAutosave: (state: AutosaveState | null) => void;
}

const SaveContext = createContext<SaveContextValue | null>(null);

/**
 * Bridges the canvas island's autosave (mounted inside React Flow by `CanvasPersistence`) and the navbar's
 * Save button (F13 FR-009). `initial` is the gate's seed result (D-034): `snapshotExists` and `savedAt`.
 */
export function SaveProvider({ initial, role, children }: { initial: SeedResult; role: ProjectRole; children: ReactNode }) {
  const [autosave, setAutosave] = useState<AutosaveState | null>(null);
  const value = useMemo(() => ({ role, seed: initial, autosave, setAutosave }), [role, initial, autosave]);
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>;
}

/** For `CanvasPersistence`; `null` outside a workspace (e.g. test pages), where autosave stays off. */
export function useOptionalSaveContext(): SaveContextValue | null {
  return useContext(SaveContext);
}

export function useSaveState(): AutosaveState & { role: ProjectRole; seed: SeedResult; mounted: boolean } {
  const ctx = useContext(SaveContext);
  if (!ctx) throw new Error('useSaveState must be used inside <SaveProvider>');
  return { ...(ctx.autosave ?? UNMOUNTED), role: ctx.role, seed: ctx.seed, mounted: ctx.autosave !== null };
}
