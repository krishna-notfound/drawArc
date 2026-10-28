'use client';

import { useReactFlow, useStoreApi, type XYPosition } from '@xyflow/react';
import {
  Circle,
  Database,
  Diamond,
  Hexagon,
  type LucideIcon,
  RectangleHorizontal,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import { Fragment, useCallback } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { useShapeDrag } from '@/hooks/useShapeDrag';
import { centredDropPosition } from '@/lib/canvas/drop-position';
import { focusNodeWhenRendered } from '@/lib/canvas/focus-node';
import { cn } from '@/lib/utils';
import { type CanvasEdge, type CanvasNode, DEFAULT_SIZES, isNodeShape, NODE_SHAPES, type PaletteKind } from '@/types/canvas';

import { ShapeDragGhost } from './shape-drag-ghost';

/** The six shapes, then the two whiteboard kinds (F22 FR-007). */
export const PALETTE_ITEMS: readonly PaletteKind[] = [...NODE_SHAPES, 'text', 'sticky'];

const ICONS: Record<PaletteKind, LucideIcon> = {
  rectangle: Square,
  diamond: Diamond,
  circle: Circle,
  pill: RectangleHorizontal,
  cylinder: Database,
  hexagon: Hexagon,
  text: Type,
  sticky: StickyNote,
};

const LABELS: Record<PaletteKind, string> = {
  rectangle: 'Add rectangle',
  diamond: 'Add diamond',
  circle: 'Add circle',
  pill: 'Add pill',
  cylinder: 'Add cylinder',
  hexagon: 'Add hexagon',
  text: 'Add text',
  sticky: 'Add sticky note',
};

const capitalise = (shape: string) => shape.charAt(0).toUpperCase() + shape.slice(1);

function tooltip(kind: PaletteKind): string {
  if (kind === 'text') return 'Text — click to place, or press T';
  if (kind === 'sticky') return 'Sticky note — click to place, or press N';
  return `${capitalise(kind)} — drag onto canvas, or press Enter`;
}

/**
 * Bottom-centre shape palette (FR-001): drag a shape onto the canvas, or click / press Enter to place it at the
 * viewport centre (FR-007). Rendered by F06's canvas only for writable members (FR-012). It reads the viewport
 * (`screenToFlowPosition`, `getZoom`) but never changes it (FR-006: no fitView or setViewport after a drop).
 */
export function ShapePalette() {
  const { screenToFlowPosition, getZoom } = useReactFlow<CanvasNode, CanvasEdge>();
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const { addNode, addNodeOfKind } = useCanvasMutations();
  const getContainer = useCallback(() => store.getState().domNode, [store]);

  const createAt = useCallback(
    (kind: PaletteKind, client: XYPosition) => {
      const position = centredDropPosition(screenToFlowPosition(client), DEFAULT_SIZES[kind]);
      const node = isNodeShape(kind) ? addNode(kind, position) : addNodeOfKind(kind, position);
      // A new text node focuses its own textarea instead.
      if (node && kind !== 'text') focusNodeWhenRendered(getContainer(), node.id);
    },
    [screenToFlowPosition, addNode, addNodeOfKind, getContainer],
  );

  const placeAtCentre = useCallback(
    (kind: PaletteKind) => {
      const rect = getContainer()?.getBoundingClientRect();
      if (rect) createAt(kind, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
    [createAt, getContainer],
  );

  const { drag, buttonProps } = useShapeDrag({ getContainer, getZoom, onDrop: createAt, onPlace: placeAtCentre });

  return (
    <>
      <div
        role="toolbar"
        aria-label="Shape palette"
        aria-orientation="horizontal"
        data-slot="shape-palette"
        className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-xl border border-surface-border bg-surface/95 p-1 shadow-lg md:gap-1 md:p-1.5"
      >
        {PALETTE_ITEMS.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <Fragment key={kind}>
              {kind === 'text' ? (
                <span role="separator" aria-orientation="vertical" className="mx-0.5 w-px self-stretch bg-surface-border" />
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={LABELS[kind]}
                    data-shape={kind}
                    className={cn(
                      'flex size-9 touch-none items-center justify-center rounded-lg text-copy-secondary outline-none select-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand md:size-10',
                      drag?.shape === kind && 'bg-brand-dim text-copy-primary',
                    )}
                    {...buttonProps(kind)}
                  >
                    <Icon className={cn('h-5 w-5', kind === 'pill' && 'rounded-full')} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{tooltip(kind)}</TooltipContent>
              </Tooltip>
            </Fragment>
          );
        })}
      </div>
      {drag ? <ShapeDragGhost drag={drag} /> : null}
    </>
  );
}
