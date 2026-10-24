'use client';

import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { type CanvasNode as CanvasNodeType, NODE_COLORS, NODE_SHAPES } from '@/types/canvas';

import { NodeHandles } from './node-handles';
import { ShapeRenderer } from './shape-renderer';

const warned = new Set<string>();

/** Storage may hold a shape/colour from a newer app version: render rectangle/neutral, warn once per id. */
function knownVisuals(id: string, data: CanvasNodeType['data']) {
  const shapeKnown = (NODE_SHAPES as readonly string[]).includes(data.shape);
  const colorKnown = Object.hasOwn(NODE_COLORS, data.color);
  if ((!shapeKnown || !colorKnown) && !warned.has(id)) {
    warned.add(id);
    // eslint-disable-next-line no-console -- client-side diagnostic; lib/logger is server-only.
    console.warn(`[canvas] node ${id} has an unknown shape or colour; rendering defaults`);
  }
  return { shape: shapeKnown ? data.shape : 'rectangle', color: colorKnown ? data.color : 'neutral' } as const;
}

/**
 * The `canvasNode` renderer (FR-009 – FR-011): one of six shapes, a centred label and four handles. Memoised so
 * a change to one node does not re-render the others (NFR-004). F08 adds the resizer, label editor and toolbar.
 */
function CanvasNodeImpl({ id, data, selected, isConnectable }: NodeProps<CanvasNodeType>) {
  const { shape, color } = knownVisuals(id, data);
  return (
    <div aria-label={`${shape} ${data.label || 'unlabelled'}`} className="h-full w-full">
      <ShapeRenderer shape={shape} color={color} selected={selected}>
        <span className="relative line-clamp-3 min-h-[1em] px-2 text-center text-sm break-words">{data.label}</span>
      </ShapeRenderer>
      <NodeHandles isConnectable={isConnectable} />
    </div>
  );
}

export const CanvasNode = memo(CanvasNodeImpl);
