'use client';

import { useBroadcastEvent, useRoom, useSelf } from '@liveblocks/react/suspense';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { type CanvasTemplate, instantiateTemplate } from '@/lib/canvas/templates';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

export interface ImportTemplateApi {
  /** Replaces the whole canvas with a fresh copy of `template`; a no-op for read-only members (FR-012). */
  importTemplate(template: CanvasTemplate): void;
  canImport: boolean;
  /** Read at call time from React Flow's store, never from render. */
  isEmptyCanvas(): boolean;
}

export const IMPORT_FIT_VIEW = { padding: 0.2, duration: 200 } as const;

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Template import (F14 FR-008–FR-010, D-14a). One `room.batch()` removes every current node and edge and adds
 * the template through the single write path, so collaborators receive one Storage message (never an empty
 * canvas in between) and the importer gets one undo step: Liveblocks nests the handlers' own batches into this
 * one. Then `CANVAS_REPLACED` is broadcast for the others' toast, and the importer's viewport is fitted once —
 * the only post-mutation `fitView` in the app (D-14d, F06 FR-009 exemption). Must render under F06's
 * `ReactFlowProvider` inside the project room.
 */
export function useImportTemplate(): ImportTemplateApi {
  const room = useRoom();
  const selfId = useSelf((me) => me.id);
  const broadcast = useBroadcastEvent();
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const mutations = useCanvasMutations();

  const isEmptyCanvas = useCallback(() => {
    const { nodes, edges } = store.getState();
    return nodes.length === 0 && edges.length === 0;
  }, [store]);

  const importTemplate = useCallback(
    (template: CanvasTemplate) => {
      if (!mutations.canEdit) return;
      const { nodes, edges } = store.getState();
      const instance = instantiateTemplate(template);
      room.batch(() => {
        if (nodes.length > 0 || edges.length > 0) mutations.onDelete({ nodes, edges });
        mutations.addNodes(instance.nodes);
        instance.edges.forEach((edge) => mutations.addEdge(edge));
      });
      // Queued while offline so collaborators still get the toast after a reconnect (EC-006).
      broadcast(
        { type: 'CANVAS_REPLACED', byUserId: selfId, templateName: template.name },
        { shouldQueueEventIfNotReady: true },
      );
      // After React renders the new nodes; React Flow queues the fit until they are initialised.
      requestAnimationFrame(() => {
        void flow.fitView({ ...IMPORT_FIT_VIEW, duration: prefersReducedMotion() ? 0 : IMPORT_FIT_VIEW.duration });
      });
    },
    [mutations, store, room, broadcast, selfId, flow],
  );

  return useMemo(
    () => ({ importTemplate, canImport: mutations.canEdit, isEmptyCanvas }),
    [importTemplate, mutations.canEdit, isEmptyCanvas],
  );
}
