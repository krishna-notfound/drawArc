'use client';

import { useReactFlow, useStoreApi, type XYPosition } from '@xyflow/react';
import { Circle, Database, Diamond, Hexagon, type LucideIcon, RectangleHorizontal, Square } from 'lucide-react';
import { useCallback } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { useShapeDrag } from '@/hooks/useShapeDrag';
import { centredDropPosition } from '@/lib/canvas/drop-position';
import { cn } from '@/lib/utils';
import { type CanvasEdge, type CanvasNode, DEFAULT_SIZES, NODE_SHAPES, type NodeShape } from '@/types/canvas';

import { ShapeDragGhost } from './shape-drag-ghost';

const ICONS: Record<NodeShape, LucideIcon> = {
  rectangle: Square,
  diamond: Diamond,
  circle: Circle,
  pill: RectangleHorizontal,
  cylinder: Database,
  hexagon: Hexagon,
};

const capitalise = (shape: NodeShape) => shape.charAt(0).toUpperCase() + shape.slice(1);

/** Moves focus to a just-created node once React Flow has rendered it (FR-008). */
function focusNodeWhenRendered(container: HTMLElement | null, id: string, framesLeft = 30) {
  requestAnimationFrame(() => {
    const el = container?.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    else if (framesLeft > 0) focusNodeWhenRendered(container, id, framesLeft - 1);
  });
}

/**
 * Bottom-centre shape palette (FR-001): drag a shape onto the canvas, or click / press Enter to place it at the
 * viewport centre (FR-007). Rendered by F06's canvas only for writable members (FR-012). It reads the viewport
 * (`screenToFlowPosition`, `getZoom`) but never changes it (FR-006: no fitView or setViewport after a drop).
 */
export function ShapePalette() {
  const { screenToFlowPosition, getZoom } = useReactFlow<CanvasNode, CanvasEdge>();
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  const { addNode } = useCanvasMutations();
  const getContainer = useCallback(() => store.getState().domNode, [store]);

  const createAt = useCallback(
    (shape: NodeShape, client: XYPosition) => {
      const flowPoint = screenToFlowPosition(client);
      const node = addNode(shape, centredDropPosition(flowPoint, DEFAULT_SIZES[shape]));
      if (node) focusNodeWhenRendered(getContainer(), node.id);
    },
    [screenToFlowPosition, addNode, getContainer],
  );

  const placeAtCentre = useCallback(
    (shape: NodeShape) => {
      const rect = getContainer()?.getBoundingClientRect();
      if (rect) createAt(shape, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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
        {NODE_SHAPES.map((shape) => {
          const Icon = ICONS[shape];
          return (
            <Tooltip key={shape}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Add ${shape}`}
                  data-shape={shape}
                  className={cn(
                    'flex size-9 touch-none items-center justify-center rounded-lg text-copy-secondary outline-none select-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand md:size-10',
                    drag?.shape === shape && 'bg-brand-dim text-copy-primary',
                  )}
                  {...buttonProps(shape)}
                >
                  <Icon className={cn('h-5 w-5', shape === 'pill' && 'rounded-full')} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{`${capitalise(shape)} — drag onto canvas, or press Enter`}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {drag ? <ShapeDragGhost drag={drag} /> : null}
    </>
  );
}
