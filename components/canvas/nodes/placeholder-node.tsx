'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

import { type CanvasNode, HANDLE_IDS, type HandleId, NODE_COLORS, NODE_SHAPES } from '@/types/canvas';

const POSITIONS: Record<HandleId, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const warned = new Set<string>();

/** Storage may hold a shape/colour from a newer app version (EC-001): render rectangle/neutral, warn once per id. */
function knownVisuals(id: string, data: CanvasNode['data']) {
  const shapeKnown = (NODE_SHAPES as readonly string[]).includes(data.shape);
  const colorKnown = Object.hasOwn(NODE_COLORS, data.color);
  if ((!shapeKnown || !colorKnown) && !warned.has(id)) {
    warned.add(id);
    // eslint-disable-next-line no-console -- client-side diagnostic; lib/logger is server-only.
    console.warn(`[canvas] node ${id} has an unknown shape or colour; rendering defaults`);
  }
  return {
    shape: shapeKnown ? data.shape : 'rectangle',
    colors: colorKnown ? NODE_COLORS[data.color] : NODE_COLORS.neutral,
  };
}

/**
 * Placeholder `canvasNode` renderer (FR-013), replaced by F08's shape renderer under the same registry key.
 * Four source handles sit at opacity 0 (never display:none, which breaks React Flow measurement) for F09.
 */
function PlaceholderNodeImpl({ id, data, width, height }: NodeProps<CanvasNode>) {
  const { shape, colors } = knownVisuals(id, data);
  const label = data.label || 'unlabelled';
  return (
    <div
      aria-label={`${shape} ${label}`}
      data-shape={shape}
      className="flex items-center justify-center rounded-md border border-surface-border bg-surface px-2 text-center text-sm"
      style={{ width, height, color: colors.text }}
    >
      <span className="line-clamp-3 break-words">{label}</span>
      {HANDLE_IDS.map((handle) => (
        <Handle key={handle} id={handle} type="source" position={POSITIONS[handle]} style={{ opacity: 0 }} />
      ))}
    </div>
  );
}

export const PlaceholderNode = memo(PlaceholderNodeImpl);
