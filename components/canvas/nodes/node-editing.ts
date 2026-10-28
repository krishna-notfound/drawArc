'use client';

import { type RefObject, useEffect } from 'react';

/** A double-click on a resize control or connection handle is not a request to edit the label. */
export const onControl = (target: EventTarget) =>
  target instanceof Element && target.closest('.react-flow__resize-control, .react-flow__handle') !== null;

/**
 * Enter on the focused node opens its editor (F08 FR-006). React Flow focuses the node wrapper
 * (`.react-flow__node`), an ancestor of the node component, so the key is read there.
 */
export function useEnterToEdit(rootRef: RefObject<HTMLElement | null>, canEdit: boolean, open: () => void): void {
  useEffect(() => {
    const wrapper = rootRef.current?.closest<HTMLElement>('.react-flow__node');
    if (!wrapper || !canEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target !== wrapper || e.repeat) return;
      e.preventDefault();
      open();
    };
    wrapper.addEventListener('keydown', onKeyDown);
    return () => wrapper.removeEventListener('keydown', onKeyDown);
  }, [rootRef, canEdit, open]);
}
