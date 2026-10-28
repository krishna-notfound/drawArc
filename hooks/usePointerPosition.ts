'use client';

import { type XYPosition, useStore } from '@xyflow/react';
import { type RefObject, useEffect, useRef } from 'react';

/** Client coordinates of the last pointer position over the canvas, or null when the pointer is elsewhere. */
export type PointerRef = RefObject<XYPosition | null>;

/**
 * Tracks the pointer over the flow container (F10 v2 "Pointer"). React Flow never calls `onPaneMouseMove` for an
 * editor — it routes pointer moves to its own selection handler whenever `selectionOnDrag` is set — so native
 * listeners on the container are used instead. The position lives in a ref: no state, no re-render (NFR-004).
 * Must run under `ReactFlowProvider`; it attaches once the container exists.
 */
export function usePointerPosition(): PointerRef {
  const pointer = useRef<XYPosition | null>(null);
  const domNode = useStore((s) => s.domNode);

  useEffect(() => {
    if (!domNode) return;
    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const onLeave = () => {
      pointer.current = null;
    };
    domNode.addEventListener('pointermove', onMove);
    domNode.addEventListener('pointerleave', onLeave);
    return () => {
      domNode.removeEventListener('pointermove', onMove);
      domNode.removeEventListener('pointerleave', onLeave);
      pointer.current = null;
    };
  }, [domNode]);

  return pointer;
}
