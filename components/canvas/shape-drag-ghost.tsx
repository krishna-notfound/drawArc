'use client';

import { createPortal } from 'react-dom';

import type { ShapeDragState } from '@/hooks/useShapeDrag';
import { resolveColor } from '@/lib/canvas/color';
import { isNodeShape } from '@/types/canvas';

import { ShapeRenderer } from './nodes/shape-renderer';

/**
 * Drag preview (FR-002, D-07c): a single fixed element on `document.body`, centred on the pointer, sized to the
 * shape at the current zoom. `pointer-events: none` keeps it out of `elementFromPoint` (FR-013); no transition, so
 * reduced-motion users get the same instant behaviour.
 */
export function ShapeDragGhost({ drag }: { drag: ShapeDragState }) {
  return createPortal(
    <div
      data-testid="shape-drag-ghost"
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        width: drag.width,
        height: drag.height,
        transform: `translate(${drag.x - drag.width / 2}px, ${drag.y - drag.height / 2}px)`,
        opacity: drag.overPane ? 0.7 : 0.4,
      }}
    >
      <GhostBody kind={drag.shape} />
    </div>,
    document.body,
  );
}

/** The preview per kind: the shape outline, a faint "Text" word, or a filled sticky square. */
function GhostBody({ kind }: { kind: ShapeDragState['shape'] }) {
  if (isNodeShape(kind)) return <ShapeRenderer shape={kind} color="neutral" ghost />;
  if (kind === 'text') {
    return <div className="flex h-full w-full items-center justify-center font-sans text-sm text-copy-faint">Text</div>;
  }
  return (
    <div
      className="h-full w-full rounded-[4px] border border-dashed border-brand"
      style={{ backgroundColor: resolveColor('orange').fill }}
    />
  );
}
