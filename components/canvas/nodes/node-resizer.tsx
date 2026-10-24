'use client';

import { NodeResizer, type ReactFlowState, useStore } from '@xyflow/react';
import type { CSSProperties } from 'react';

import { MIN_SIZE, type NodeShape } from '@/types/canvas';

export interface CanvasNodeResizerProps {
  shape: NodeShape;
}

const inverseZoom = (s: ReactFlowState) => 1 / s.transform[2];

/**
 * React Flow's resizer with drawArc's fixed contract (F08 FR-001, FR-003, FR-005): 48 × 32 minimum, a square circle,
 * brand handles. Mount it only for a selected node of an editor, so the zoom subscription below exists for the
 * selection alone. Handles keep their 8 px screen size at every zoom (`--canvas-handle-scale`, app/globals.css);
 * the library's `autoScale` only compensates zoom-out. Resizing writes nothing itself: the gesture's dimension and
 * position changes go through `onNodesChange` to Liveblocks, which records the gesture as one undo step.
 */
export function CanvasNodeResizer({ shape }: CanvasNodeResizerProps) {
  const scale = useStore(inverseZoom);
  return (
    <NodeResizer
      minWidth={MIN_SIZE.width}
      minHeight={MIN_SIZE.height}
      keepAspectRatio={shape === 'circle'}
      autoScale={false}
      handleClassName="canvas-resize-handle"
      handleStyle={{ '--canvas-handle-scale': scale } as CSSProperties}
      lineClassName="canvas-resize-line"
    />
  );
}
