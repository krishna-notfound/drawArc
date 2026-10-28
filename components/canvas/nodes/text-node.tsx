'use client';

import type { NodeProps } from '@xyflow/react';

import type { CanvasNode as CanvasNodeType } from '@/types/canvas';

import { ShapeNode } from './shape-node';

/** Stub until the text node lands (F22 Task 7). */
export function TextNode(props: NodeProps<CanvasNodeType>) {
  return <ShapeNode {...props} shape="rectangle" />;
}
