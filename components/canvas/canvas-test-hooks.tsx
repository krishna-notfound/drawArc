'use client';

import { useHistory } from '@liveblocks/react/suspense';
import { type ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

import { type CanvasMutations, useCanvasMutations } from '@/hooks/useCanvasMutations';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

declare global {
  interface Window {
    __rf?: ReactFlowInstance<CanvasNode, CanvasEdge>;
    __canvasMutations?: CanvasMutations;
    /** F08: this client's Liveblocks history, so undo-granularity specs do not depend on F10's shortcuts. */
    __history?: Pick<ReturnType<typeof useHistory>, 'undo' | 'redo' | 'canUndo' | 'canRedo'>;
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
  useEffect(() => {
    window.__rf = instance;
    window.__canvasMutations = mutations;
    window.__history = history;
    return () => {
      delete window.__rf;
      delete window.__canvasMutations;
      delete window.__history;
    };
  }, [instance, mutations, history]);
  return null;
}
