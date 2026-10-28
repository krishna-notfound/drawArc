import type { XYPosition } from '@xyflow/react';

import { MAX_LABEL } from '@/lib/canvas/schema';
import * as canvasTypes from '@/types/canvas';

/**
 * The only F22-aware module (D-10j). F22 (text and sticky notes) adds `NODE_KINDS`, `TEXT_MAX_LENGTH` and
 * `useCanvasMutations().addNodeOfKind`; this branch must build and pass with or without them, so they are read
 * through widened types and fall back to the v1 shapes.
 */
const types = canvasTypes as unknown as { NODE_KINDS?: readonly string[]; TEXT_MAX_LENGTH?: number };

export function canvasKinds(): readonly string[] {
  return types.NODE_KINDS ?? canvasTypes.NODE_SHAPES;
}

export function hasTextKind(): boolean {
  return canvasKinds().includes('text');
}

export function textMaxLength(): number {
  return types.TEXT_MAX_LENGTH ?? MAX_LABEL;
}

export type TextInserter = (position: XYPosition, init: { label: string }) => unknown;

/** A bound text-node inserter when F22's kind and mutation both exist, otherwise null (pasted prose is then ignored). */
export function textInserter(mutations: object): TextInserter | null {
  const add = (mutations as { addNodeOfKind?: unknown }).addNodeOfKind;
  if (!hasTextKind() || typeof add !== 'function') return null;
  return (position, init) =>
    (add as (kind: string, p: XYPosition, i: { label: string }) => unknown).call(mutations, 'text', position, init);
}
