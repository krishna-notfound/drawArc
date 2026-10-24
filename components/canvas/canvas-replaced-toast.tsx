'use client';

import { useEventListener, useSelf } from '@liveblocks/react/suspense';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';

import { IMPORT_FIT_VIEW, prefersReducedMotion } from '@/hooks/useImportTemplate';

export const CANVAS_REPLACED_TOAST_MS = 6_000;

export function canvasReplacedMessage(name: string | undefined, templateName: string | undefined): string {
  const who = name?.trim() || 'Someone';
  return templateName ? `${who} replaced the diagram with "${templateName}"` : `${who} replaced the diagram`;
}

/**
 * Tells everyone else when a template replaced the canvas (F14 FR-009): a 6 s toast with a "Fit view" action
 * that fits only this user's viewport. The importer gets no toast. Must render inside React Flow in the room.
 */
export function CanvasReplacedToast() {
  const selfId = useSelf((me) => me.id);
  const flow = useReactFlow();
  useEventListener(({ event, user }) => {
    if (event.type !== 'CANVAS_REPLACED' || event.byUserId === selfId) return;
    const message = canvasReplacedMessage(user?.info.name, event.templateName);
    // The id dedupes repeated identical events into one toast.
    toast(message, {
      id: `canvas-replaced:${message}`,
      duration: CANVAS_REPLACED_TOAST_MS,
      action: {
        label: 'Fit view',
        onClick: () => {
          void flow.fitView({ ...IMPORT_FIT_VIEW, duration: prefersReducedMotion() ? 0 : IMPORT_FIT_VIEW.duration });
        },
      },
    });
  });
  return null;
}
