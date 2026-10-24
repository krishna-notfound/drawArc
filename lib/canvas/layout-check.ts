import type { PersistedNode } from '@/types/canvas';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Sized = Pick<PersistedNode, 'position' | 'width' | 'height'>;

/** A persisted node's rectangle in flow coordinates (node origin is the top-left corner, F06). */
export function nodeRect(node: Sized): Rect {
  return { x: node.position.x, y: node.position.y, width: node.width, height: node.height };
}

/** True when `a` and `b`, each expanded by `margin` on every side, intersect (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x - margin < b.x + b.width + margin &&
    b.x - margin < a.x + a.width + margin &&
    a.y - margin < b.y + b.height + margin &&
    b.y - margin < a.y + a.height + margin
  );
}

/**
 * Pairs of node ids whose rectangles overlap after expanding each by `margin` (F14 FR-002: the default 20 px
 * margin means a minimum gap of 40 px). Pure; reused by F17 to check agent output.
 */
export function findOverlaps(nodes: readonly (Sized & { id: string })[], margin = 20): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rectsOverlap(nodeRect(nodes[i]), nodeRect(nodes[j]), margin)) pairs.push([nodes[i].id, nodes[j].id]);
    }
  }
  return pairs;
}

/** The union of the nodes' rectangles; `null` for an empty list. */
export function boundsOf(nodes: readonly Sized[]): Rect | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
