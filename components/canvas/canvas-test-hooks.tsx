'use client';

import { useHistory } from '@liveblocks/react/suspense';
import { type ReactFlowInstance, useReactFlow, useStoreApi } from '@xyflow/react';
import { useEffect } from 'react';

import { type CanvasMutations, useCanvasMutations } from '@/hooks/useCanvasMutations';
import { memoryClipboard } from '@/lib/canvas/clipboard';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

declare global {
  interface Window {
    __rf?: ReactFlowInstance<CanvasNode, CanvasEdge>;
    __canvasMutations?: CanvasMutations;
    /** F08: this client's Liveblocks history, so undo-granularity specs do not depend on F10's shortcuts. */
    __history?: Pick<ReturnType<typeof useHistory>, 'undo' | 'redo' | 'canUndo' | 'canRedo'>;
    /** F10 v2: the in-memory clipboard copy, so specs read what Copy wrote without the Clipboard API. */
    __clipboard?: typeof memoryClipboard;
    /** F10 v2: the React Flow store, so specs can read `snapToGrid`, `snapGrid` and node runtime flags. */
    __rfStore?: ReturnType<typeof useStoreApi<CanvasNode, CanvasEdge>>;
  }
}

/**
 * E2E-only (F07 plan notes): exposes the React Flow instance and the canvas write path on `window` so Playwright
 * can set the viewport and probe the viewer gate, plus (F08) this client's undo history. Mounted only when `NEXT_PUBLIC_E2E_HOOKS=1` (`e2eHooksEnabled`).
 */
export function CanvasTestHooks() {
  const instance = useReactFlow<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();
  const history = useHistory();
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  useEffect(() => {
    window.__rf = instance;
    window.__canvasMutations = mutations;
    window.__history = history;
    window.__clipboard = memoryClipboard;
    window.__rfStore = store;
    return () => {
      delete window.__rf;
      delete window.__canvasMutations;
      delete window.__history;
      delete window.__clipboard;
      delete window.__rfStore;
    };
  }, [instance, mutations, history, store]);
  return null;
}
