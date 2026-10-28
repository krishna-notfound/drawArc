'use client';

import { NodeToolbar, Position } from '@xyflow/react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useArrange, useMovableSelectedCount } from '@/hooks/useArrange';
import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { useSelectedNodeIds } from '@/hooks/useSelectedNodeIds';
import type { AlignMode, Axis } from '@/lib/canvas/align';
import { ariaKeyShortcuts, bindingFor, formatKeys, type ShortcutAction } from '@/lib/canvas/registry';
import { detectPlatform } from '@/lib/canvas/shortcuts';

type Entry = { action: ShortcutAction; icon: LucideIcon; run: (arrange: ReturnType<typeof useArrange>) => void };
const align = (action: ShortcutAction, icon: LucideIcon, mode: AlignMode): Entry => ({ action, icon, run: (a) => a.align(mode) });
const distribute = (action: ShortcutAction, icon: LucideIcon, axis: Axis): Entry => ({ action, icon, run: (a) => a.distribute(axis) });

const ALIGN_ENTRIES: readonly Entry[] = [
  align('alignLeft', AlignStartVertical, 'left'),
  align('alignCenterH', AlignCenterVertical, 'centerH'),
  align('alignRight', AlignEndVertical, 'right'),
  align('alignTop', AlignStartHorizontal, 'top'),
  align('alignMiddleV', AlignCenterHorizontal, 'middleV'),
  align('alignBottom', AlignEndHorizontal, 'bottom'),
];
const DISTRIBUTE_ENTRIES: readonly Entry[] = [
  distribute('distributeH', AlignHorizontalDistributeCenter, 'h'),
  distribute('distributeV', AlignVerticalDistributeCenter, 'v'),
];

const noSubscribe = () => () => {};
const serverPlatform = () => 'other' as const;

/**
 * Floating align / distribute toolbar below a multi-selection (F10 v2 FR-022, D-10k): six align buttons, plus two
 * distribute buttons from three nodes. Labels, hints and `aria-keyshortcuts` come from the registry. Rendered inside
 * `<ReactFlow>`; absent for read-only members and when fewer than two selected nodes can move (locked ones cannot).
 */
export function SelectionToolbar() {
  const { canEdit } = useCanvasMutations();
  const ids = useSelectedNodeIds();
  const movable = useMovableSelectedCount();
  const arrange = useArrange();
  const platform = useSyncExternalStore(noSubscribe, detectPlatform, serverPlatform);

  if (!canEdit || movable < 2) return null;
  const entries = movable >= 3 ? [...ALIGN_ENTRIES, ...DISTRIBUTE_ENTRIES] : ALIGN_ENTRIES;

  return (
    <NodeToolbar nodeId={ids} isVisible position={Position.Bottom} offset={12} align="center" className="nodrag nopan">
      <div
        role="toolbar"
        aria-label="Arrange selection"
        className="flex gap-0.5 rounded-xl border border-surface-border bg-surface/95 p-1 shadow-lg"
      >
        {entries.map(({ action, icon: Icon, run }) => {
          const { label } = bindingFor(action);
          const hint = formatKeys(action, platform);
          return (
            <Tooltip key={action}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  aria-keyshortcuts={ariaKeyShortcuts(action) || undefined}
                  onClick={() => run(arrange)}
                  className="flex size-8 items-center justify-center rounded-lg text-copy-secondary outline-none hover:bg-subtle hover:text-copy-primary focus-visible:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{hint ? `${label} (${hint})` : label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </NodeToolbar>
  );
}
