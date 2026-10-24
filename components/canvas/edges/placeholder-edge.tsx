'use client';

import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { memo } from 'react';

import type { CanvasEdge } from '@/types/canvas';

/** Placeholder `canvasEdge` renderer (FR-013): a smooth-step path. F09 replaces it under the same registry key. */
function PlaceholderEdgeImpl({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps<CanvasEdge>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

export const PlaceholderEdge = memo(PlaceholderEdgeImpl);
