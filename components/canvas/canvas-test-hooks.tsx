'use client';

import { useRoom } from '@liveblocks/react/suspense';
import { type ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

import { type CanvasMutations, useCanvasMutations } from '@/hooks/useCanvasMutations';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

declare global {
  interface Window {
    __rf?: ReactFlowInstance<CanvasNode, CanvasEdge>;
    __canvasMutations?: CanvasMutations;
    /** F09: the room's undo stack, to assert one undo entry per action. */
    __history?: { undo(): void; redo(): void; canUndo(): boolean };
  }
}

/**
 * E2E-only (F07 plan notes): exposes the React Flow instance and the canvas write path on `window` so Playwright
 * can set the viewport, probe the viewer gate and step the undo stack. Mounted only when `NEXT_PUBLIC_E2E_HOOKS=1` (`e2eHooksEnabled`).
 */
export function CanvasTestHooks() {
  const instance = useReactFlow<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();
  const room = useRoom();
  useEffect(() => {
    window.__rf = instance;
    window.__canvasMutations = mutations;
    window.__history = {
      undo: () => room.history.undo(),
      redo: () => room.history.redo(),
      canUndo: () => room.history.canUndo(),
    };
    return () => {
      delete window.__rf;
      delete window.__canvasMutations;
      delete window.__history;
    };
  }, [instance, mutations, room]);
  return null;
}
