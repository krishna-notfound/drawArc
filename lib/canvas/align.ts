import type { XYPosition } from '@xyflow/react';

import { type CanvasNode, DEFAULT_SIZES } from '@/types/canvas';

/**
 * Pure align / distribute geometry (F10 v2 FR-020/021, D-10k), on stored node boxes in flow coordinates
 * (`nodeOrigin` is `[0, 0]`, so `x`/`y` are the top-left corner). No React.
 */
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'middleV';
export type Axis = 'h' | 'v';

export interface NodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

type Move = { id: string; position: XYPosition };

/** `data.locked === true` (an optional field F22 adds); a locked node is never moved and never sizes the bounding box. */
export function isLocked(data: Record<string, unknown>): boolean {
  return data.locked === true;
}

/** Selected nodes as boxes: width/height follow the persistence rule (stored, else measured, else the shape default). */
export function selectedBoxes(nodes: readonly CanvasNode[]): NodeBox[] {
  return nodes
    .filter((n) => n.selected)
    .map((n) => {
      const fallback = DEFAULT_SIZES[n.data.shape] ?? DEFAULT_SIZES.rectangle;
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? n.measured?.width ?? fallback.width,
        height: n.height ?? n.measured?.height ?? fallback.height,
        ...(isLocked(n.data) ? { locked: true } : {}),
      };
    });
}

const movable = (boxes: readonly NodeBox[]) => boxes.filter((b) => !b.locked);

/**
 * Aligns the movable boxes to the bounding box of the movable set. Returns only the boxes whose position changes,
 * in input order; `[]` below two movable boxes, so nothing is written and no undo entry is made.
 */
export function alignNodes(boxes: readonly NodeBox[], mode: AlignMode): Move[] {
  const set = movable(boxes);
  if (set.length < 2) return [];
  const minX = Math.min(...set.map((b) => b.x));
  const maxX = Math.max(...set.map((b) => b.x + b.width));
  const minY = Math.min(...set.map((b) => b.y));
  const maxY = Math.max(...set.map((b) => b.y + b.height));
  const target = (b: NodeBox): XYPosition => {
    switch (mode) {
      case 'left':
        return { x: minX, y: b.y };
      case 'right':
        return { x: maxX - b.width, y: b.y };
      case 'top':
        return { x: b.x, y: minY };
      case 'bottom':
        return { x: b.x, y: maxY - b.height };
      case 'centerH':
        return { x: (minX + maxX) / 2 - b.width / 2, y: b.y };
      case 'middleV':
        return { x: b.x, y: (minY + maxY) / 2 - b.height / 2 };
    }
  };
  return set.flatMap((b) => {
    const position = target(b);
    return position.x === b.x && position.y === b.y ? [] : [{ id: b.id, position }];
  });
}

/**
 * Spreads the movable boxes with equal gaps between them, the outermost two staying put. Sorted by position
 * (ties by id); `[]` below three movable boxes.
 */
export function distributeNodes(boxes: readonly NodeBox[], axis: Axis): Move[] {
  const h = axis === 'h';
  const start = (b: NodeBox) => (h ? b.x : b.y);
  const size = (b: NodeBox) => (h ? b.width : b.height);
  const set = [...movable(boxes)].sort((a, b) => start(a) - start(b) || a.id.localeCompare(b.id));
  if (set.length < 3) return [];
  const first = set[0]!;
  const last = set[set.length - 1]!;
  const span = start(last) + size(last) - start(first);
  const gap = (span - set.reduce((sum, b) => sum + size(b), 0)) / (set.length - 1);
  const moves: Move[] = [];
  let cursor = start(first) + size(first) + gap;
  for (const b of set.slice(1, -1)) {
    if (cursor !== start(b)) moves.push({ id: b.id, position: h ? { x: cursor, y: b.y } : { x: b.x, y: cursor } });
    cursor += size(b) + gap;
  }
  return moves;
}
