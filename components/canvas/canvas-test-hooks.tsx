'use client';

import { type ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

import { type CanvasMutations, useCanvasMutations } from '@/hooks/useCanvasMutations';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

declare global {
  interface Window {
    __rf?: ReactFlowInstance<CanvasNode, CanvasEdge>;
    __canvasMutations?: CanvasMutations;
  }
}

/**
 * E2E-only (F07 plan notes): exposes the React Flow instance and the canvas write path on `window` so Playwright
 * can set the viewport and probe the viewer gate. Mounted only when `NEXT_PUBLIC_E2E_HOOKS=1`, a build-time
 * constant, so production bundles drop it.
 */
export function CanvasTestHooks() {
  const instance = useReactFlow<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();
  useEffect(() => {
    window.__rf = instance;
    window.__canvasMutations = mutations;
    return () => {
      delete window.__rf;
      delete window.__canvasMutations;
    };
  }, [instance, mutations]);
  return null;
}
