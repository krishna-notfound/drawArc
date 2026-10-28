'use client';

import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { type CanvasNode as CanvasNodeType, type CanvasNodeData, isNodeKind, type NodeKind } from '@/types/canvas';

import { ReservedKindNode } from './reserved-kind-node';
import { ShapeNode } from './shape-node';
import { StickyNode } from './sticky-node';
import { TextNode } from './text-node';
import { warnOnce } from './warn-once';

/** Storage may hold a shape from a newer app version: render a rectangle, warn once per id (F07 EC-001). */
export function kindOf(id: string, data: CanvasNodeData): NodeKind {
  if (isNodeKind(data.shape)) return data.shape;
  warnOnce(id, 'has an unknown shape; rendering a rectangle');
  return 'rectangle';
}

/**
 * The single `canvasNode` renderer (D-22a): dispatches on `data.shape` so `nodeTypes`, `type: 'canvasNode'` and the
 * serialisers never change when a kind is added. Memoised so a change to one node does not re-render the others
 * (NFR-004).
 */
function CanvasNodeImpl(props: NodeProps<CanvasNodeType>) {
  const kind = kindOf(props.id, props.data);
  switch (kind) {
    case 'rectangle':
    case 'diamond':
    case 'circle':
    case 'pill':
    case 'cylinder':
    case 'hexagon':
      return <ShapeNode {...props} shape={kind} />;
    case 'text':
      return <TextNode {...props} />;
    case 'sticky':
      return <StickyNode {...props} />;
    case 'line':
    case 'freehand':
    case 'frame':
    case 'image':
      return <ReservedKindNode {...props} kind={kind} />;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export const CanvasNode = memo(CanvasNodeImpl);
