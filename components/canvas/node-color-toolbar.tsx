'use client';

import { NodeToolbar, Position } from '@xyflow/react';
import { Check } from 'lucide-react';
import { type CSSProperties, type KeyboardEvent, useRef } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { useSelectedNodeIds, useSelectionColor } from '@/hooks/useSelectedNodeIds';
import { cn } from '@/lib/utils';
import { NODE_COLOR_IDS, NODE_COLORS, type NodeColorId } from '@/types/canvas';

const capitalise = (id: string) => id[0]!.toUpperCase() + id.slice(1);

/** Roving focus targets for the swatch radiogroup (wrapping arrows, Home/End). */
function nextIndex(key: string, current: number): number | null {
  const last = NODE_COLOR_IDS.length - 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return current === last ? 0 : current + 1;
    case 'ArrowLeft':
    case 'ArrowUp':
      return current === 0 ? last : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/**
 * One floating colour toolbar above the whole selection (F08 FR-011, FR-012, D-08b): eight swatches as a radiogroup
 * with a roving tabindex; a swatch recolours every selected node in one change (one undo step). Rendered inside
 * `<ReactFlow>`; absent for read-only members and for an empty selection.
 */
export function NodeColorToolbar() {
  const { canEdit, updateNodesData } = useCanvasMutations();
  const ids = useSelectedNodeIds();
  const active = useSelectionColor(ids);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  if (!canEdit || ids.length === 0) return null;
  const tabStop = active === null ? 0 : NODE_COLOR_IDS.indexOf(active);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = buttons.current.findIndex((b) => b === document.activeElement);
    const next = nextIndex(e.key, current === -1 ? tabStop : current);
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    buttons.current[next]?.focus();
  };

  const apply = (color: NodeColorId) => updateNodesData(ids, { color });

  return (
    <NodeToolbar nodeId={ids} isVisible position={Position.Top} offset={12} align="center" className="nodrag nopan">
      <div
        role="radiogroup"
        aria-label="Node colour"
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-xl border border-surface-border bg-surface/95 p-1 shadow-lg"
      >
        {NODE_COLOR_IDS.map((id, index) => {
          const { fill, text } = NODE_COLORS[id];
          const checked = active === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  ref={(el) => {
                    buttons.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={`Colour: ${id}`}
                  tabIndex={index === tabStop ? 0 : -1}
                  onClick={() => apply(id)}
                  data-color={id}
                  className={cn(
                    'canvas-swatch flex size-5 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    checked && 'outline-2 outline-offset-2 outline-brand',
                  )}
                  // `--swatch-glow`: the text colour at 33 % alpha (0x55), for the hover ring.
                  style={{ backgroundColor: fill, borderColor: text, '--swatch-glow': `${text}55` } as CSSProperties}
                >
                  {checked ? <Check className="size-3" style={{ color: text }} strokeWidth={3} aria-hidden="true" /> : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{capitalise(id)}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </NodeToolbar>
  );
}
