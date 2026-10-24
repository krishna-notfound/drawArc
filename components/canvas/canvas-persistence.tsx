'use client';

import { useSelf } from '@liveblocks/react/suspense';
import { useStoreApi } from '@xyflow/react';
import { useEffect } from 'react';

import { useOptionalSaveContext } from '@/components/editor/save-context';
import { type FlowStoreLike, useAutosave } from '@/hooks/useAutosave';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

/**
 * Mounts the canvas autosave inside `<ReactFlow>` (F13) and publishes its state to the navbar Save button via
 * `SaveProvider`. Renders nothing. Autosave runs only for owners/editors whose Liveblocks token can write
 * (archived projects issue read-only tokens), and only inside a workspace.
 */
export function CanvasPersistence({ projectId }: { projectId: string }) {
  const ctx = useOptionalSaveContext();
  const tokenCanWrite = useSelf((me) => me.canWrite);
  const store = useStoreApi<CanvasNode, CanvasEdge>() as unknown as FlowStoreLike;
  const enabled = ctx !== null && ctx.role !== 'viewer' && tokenCanWrite;
  const autosave = useAutosave({
    projectId,
    enabled,
    snapshotExists: ctx?.seed.snapshotExists ?? false,
    initialSavedAt: ctx?.seed.savedAt ?? null,
    store,
  });

  const setAutosave = ctx?.setAutosave;
  const { status, lastSavedAt, lastError, save } = autosave;
  useEffect(() => {
    setAutosave?.({ status, lastSavedAt, lastError, save });
  }, [setAutosave, status, lastSavedAt, lastError, save]);
  useEffect(() => () => setAutosave?.(null), [setAutosave]);

  return null;
}
