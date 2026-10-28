'use client';

import {
  NodeResizeControl,
  NodeResizer,
  type OnResizeEnd,
  type ReactFlowState,
  ResizeControlVariant,
  useStore,
} from '@xyflow/react';
import type { CSSProperties } from 'react';

import { MIN_SIZES, type NodeKind } from '@/types/canvas';

export interface CanvasNodeResizerProps {
  kind: NodeKind;
  /** `'horizontal'` renders only the left and right line controls (text nodes, F22 FR-011). */
  sides?: 'all' | 'horizontal';
  /** Called once when the gesture ends, after its dimension changes went through `onNodesChange`. */
  onResizeEnd?: OnResizeEnd;
}

const inverseZoom = (s: ReactFlowState) => 1 / s.transform[2];

/**
 * React Flow's resizer with drawArc's fixed contract (F08 FR-001, FR-003, FR-005): the kind's minimum size
 * (`MIN_SIZES`: 48 × 32, text 24 × 20, sticky 75 × 75), a square circle, brand handles. Mount it only for a selected
 * node of an editor, so the zoom subscription below exists for the selection alone. Handles keep their 8 px screen
 * size at every zoom (`--canvas-handle-scale`, app/globals.css); the library's `autoScale` only compensates
 * zoom-out. Resizing writes nothing itself: the gesture's dimension and position changes go through
 * `onNodesChange` to Liveblocks, which records the gesture as one undo step.
 */
export function CanvasNodeResizer({ kind, sides = 'all', onResizeEnd }: CanvasNodeResizerProps) {
  const scale = useStore(inverseZoom);
  const min = MIN_SIZES[kind];
  if (sides === 'horizontal') {
    return (
      <>
        {(['left', 'right'] as const).map((position) => (
          <NodeResizeControl
            key={position}
            variant={ResizeControlVariant.Line}
            position={position}
            minWidth={min.width}
            autoScale={false}
            className="canvas-resize-line"
            onResizeEnd={onResizeEnd}
          />
        ))}
      </>
    );
  }
  return (
    <NodeResizer
      minWidth={min.width}
      minHeight={min.height}
      keepAspectRatio={kind === 'circle'}
      autoScale={false}
      handleClassName="canvas-resize-handle"
      handleStyle={{ '--canvas-handle-scale': scale } as CSSProperties}
      lineClassName="canvas-resize-line"
      onResizeEnd={onResizeEnd}
    />
  );
}
