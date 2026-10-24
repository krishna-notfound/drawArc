'use client';

import { useUpdateMyPresence } from '@liveblocks/react/suspense';
import { Cursors } from '@liveblocks/react-flow';
import { useEffect } from 'react';

import { CanvasCursor } from './canvas-cursor';

const CURSOR_COMPONENTS = { Cursor: CanvasCursor };

/**
 * Live cursors (FR-002, FR-004; P-11-1). Render inside `<ReactFlow>` (FlowCanvas children). `<Cursors/>` writes
 * `presence.cursor` in flow coordinates on pointer move and clears it on pointer leave, window blur and unmount;
 * the effect adds the missing case (P-11-2): a hidden tab clears it too, so no frozen cursor stays on others'
 * canvases.
 */
export function LiveCursors() {
  const updateMyPresence = useUpdateMyPresence();
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') updateMyPresence({ cursor: null });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [updateMyPresence]);
  return <Cursors components={CURSOR_COMPONENTS} />;
}
