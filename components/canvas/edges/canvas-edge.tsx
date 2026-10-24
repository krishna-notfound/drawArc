'use client';

import {
  BaseEdge,
  type EdgeProps,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type InternalNode,
  type ReactFlowState,
  useStore,
} from '@xyflow/react';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import type { CanvasEdge as CanvasEdgeType, CanvasNode } from '@/types/canvas';

import { EdgeLabelEditor } from './edge-label-editor';

const nodeName = (node: InternalNode<CanvasNode> | undefined) =>
  node ? node.internals.userNode.data.label || node.internals.userNode.data.shape : 'unknown node';

/** "edge from API to cylinder, labelled SQL" (FR-010). */
export function edgeAriaLabel(source: string, target: string, label: string): string {
  return `edge from ${source} to ${target}${label ? `, labelled ${label}` : ''}`;
}

/**
 * The `canvasEdge` renderer (F09 FR-002, FR-006 – FR-010): a smooth-step path with a 20 px invisible hit area, the
 * arrowhead from `defaultEdgeOptions` (D-09c), a pill badge for its label, and an inline label editor on
 * double-click for editors. Rest / hover / selected styles live in app/globals.css (CSS hover, no React state).
 */
function CanvasEdgeImpl({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<CanvasEdgeType>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });
  const { canEdit, updateEdgeData } = useCanvasMutations();
  const [editing, setEditing] = useState(false);
  const label = data?.label ?? '';

  const ariaLabel = useStore(
    useCallback(
      (s: ReactFlowState) => {
        const { nodeLookup } = s as unknown as ReactFlowState<CanvasNode, CanvasEdgeType>;
        return edgeAriaLabel(nodeName(nodeLookup.get(source)), nodeName(nodeLookup.get(target)), label);
      },
      [source, target, label],
    ),
  );
  // React Flow's edge wrapper owns the focusable group and labels it from the raw ids unless the persisted edge
  // carries `ariaLabel`, which schema v1 does not store; so the readable label is applied to the wrapper here.
  const group = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    group.current?.closest('.react-flow__edge')?.setAttribute('aria-label', ariaLabel);
  }, [ariaLabel]);

  const commit = (value: string) => {
    setEditing(false);
    if (value !== label) updateEdgeData(id, { label: value || undefined });
  };

  const content = editing ? (
    <EdgeLabelEditor initial={label} onCommit={commit} onCancel={() => setEditing(false)} />
  ) : label ? (
    <span className="block rounded-xl border border-surface-border bg-elevated px-2 py-0.5 text-xs whitespace-nowrap text-copy-secondary">
      {label}
    </span>
  ) : selected && canEdit ? (
    <span className="block rounded-xl px-2 py-0.5 text-xs whitespace-nowrap text-copy-faint">Double-click to label</span>
  ) : null;

  return (
    <g ref={group} className="canvas-edge" onDoubleClick={canEdit ? () => setEditing(true) : undefined}>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={20} />
      {content ? (
        <EdgeLabelRenderer>
          <div
            data-edge-label={id}
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          >
            {content}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

export const CanvasEdge = memo(CanvasEdgeImpl);
