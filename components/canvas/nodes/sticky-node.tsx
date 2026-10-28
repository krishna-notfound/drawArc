'use client';

import type { NodeProps } from '@xyflow/react';

import type { CanvasNode as CanvasNodeType } from '@/types/canvas';

import { ShapeNode } from './shape-node';

/** Stub until the sticky note lands (F22 Task 8). */
export function StickyNode(props: NodeProps<CanvasNodeType>) {
  return <ShapeNode {...props} shape="rectangle" />;
}
