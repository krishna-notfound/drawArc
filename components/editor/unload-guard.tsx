'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { publicEnv } from '@/lib/env.public';

export interface UnloadGuard {
  /** Skips the unsynced-changes `beforeunload` prompt for the rest of this page's life (forced reloads). */
  suppress(): void;
  /** True once `suppress()` ran: a forced reload is under way, so room errors are no longer surfaced. */
  isSuppressed(): boolean;
  /** Shows the full-viewport "access changed" overlay until the page reloads (FR-013). */
  showAccessChanged(): void;
}

declare global {
  interface Window {
    /** Test hook, only with NEXT_PUBLIC_E2E_HOOKS=1. */
    __unloadGuard?: UnloadGuard;
  }
}

export const ACCESS_CHANGED_COPY = 'Your access to this project was changed by the owner. Reloading…';

const UnloadGuardContext = createContext<UnloadGuard | null>(null);

// Liveblocks' `preventUnsavedChanges` adds a bubbling `beforeunload` listener on `window`. A capturing listener
// on the same target runs first and stops it, so a forced reload (KICK, ROLE_CHANGED) never shows the prompt.
function swallowBeforeUnload(event: Event): void {
  event.stopImmediatePropagation();
}

/**
 * Owns the bypass for Liveblocks' unsaved-changes guard (FR-012) and the access-changed overlay. It sits
 * outside the Liveblocks providers so neither is lost when the room re-suspends after `client.logout()`.
 */
export function UnloadGuardProvider({ children }: { children: ReactNode }) {
  const suppressed = useRef(false);
  const [accessChanged, setAccessChanged] = useState(false);

  const guard = useMemo<UnloadGuard>(
    () => ({
      suppress: () => {
        suppressed.current = true;
        window.addEventListener('beforeunload', swallowBeforeUnload, { capture: true });
      },
      isSuppressed: () => suppressed.current,
      showAccessChanged: () => setAccessChanged(true),
    }),
    [],
  );

  useEffect(() => {
    if (publicEnv.NEXT_PUBLIC_E2E_HOOKS === '1') window.__unloadGuard = guard;
    return () => {
      window.removeEventListener('beforeunload', swallowBeforeUnload, { capture: true });
      if (window.__unloadGuard === guard) delete window.__unloadGuard;
    };
  }, [guard]);

  return (
    <UnloadGuardContext.Provider value={guard}>
      {children}
      {accessChanged ? (
        <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4">
          <p className="text-sm text-copy-primary">{ACCESS_CHANGED_COPY}</p>
        </div>
      ) : null}
    </UnloadGuardContext.Provider>
  );
}

export function useUnloadGuard(): UnloadGuard {
  const guard = useContext(UnloadGuardContext);
  if (!guard) throw new Error('useUnloadGuard must be used inside <UnloadGuardProvider>');
  return guard;
}
