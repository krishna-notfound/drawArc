import type { XYPosition } from '@xyflow/react';

/**
 * Top-left position for a node whose centre must sit on `flowPoint` (FR-004). React Flow's `nodeOrigin` is
 * `[0, 0]`, so a node positioned at the pointer would hang below-right of it (reference bug §4). `flowPoint` is
 * already in flow coordinates (`screenToFlowPosition`), so pan and zoom are accounted for before this runs.
 */
export function centredDropPosition(flowPoint: XYPosition, size: { width: number; height: number }): XYPosition {
  return { x: flowPoint.x - size.width / 2, y: flowPoint.y - size.height / 2 };
}
