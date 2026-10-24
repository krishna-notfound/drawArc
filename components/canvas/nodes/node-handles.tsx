import { Handle, Position } from '@xyflow/react';

import { HANDLE_IDS, type HandleId } from '@/types/canvas';

const POSITIONS: Record<HandleId, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/**
 * Four source handles with unique ids (FR-010); `ConnectionMode.Loose` (F06) lets any handle start or end a
 * connection (reference bug §3: top-only handles). Hidden with opacity in `.canvas-handle` (app/globals.css),
 * never `display: none`, which would make React Flow measure them as 0 × 0.
 */
export function NodeHandles({ isConnectable }: { isConnectable: boolean }) {
  return HANDLE_IDS.map((id) => (
    <Handle
      key={id}
      id={id}
      type="source"
      position={POSITIONS[id]}
      isConnectable={isConnectable}
      className="canvas-handle"
    />
  ));
}
