'use client';

import type { NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { type CanvasNode as CanvasNodeType, NODE_COLORS, NODE_SHAPES } from '@/types/canvas';

import { NodeHandles } from './node-handles';
import { NodeLabel } from './node-label';
import { NodeLabelEditor } from './node-label-editor';
import { CanvasNodeResizer } from './node-resizer';
import { ShapeRenderer } from './shape-renderer';

const warned = new Set<string>();

/** Storage may hold a shape/colour from a newer app version: render rectangle/neutral, warn once per id. */
function knownVisuals(id: string, data: CanvasNodeType['data']) {
  const shapeKnown = (NODE_SHAPES as readonly string[]).includes(data.shape);
  const colorKnown = Object.hasOwn(NODE_COLORS, data.color);
  if ((!shapeKnown || !colorKnown) && !warned.has(id)) {
    warned.add(id);
    // eslint-disable-next-line no-console -- client-side diagnostic; lib/logger is server-only.
    console.warn(`[canvas] node ${id} has an unknown shape or colour; rendering defaults`);
  }
  return { shape: shapeKnown ? data.shape : 'rectangle', color: colorKnown ? data.color : 'neutral' } as const;
}

/** A double-click on a resize control or connection handle is not a request to edit the label. */
const onControl = (target: EventTarget) =>
  target instanceof Element && target.closest('.react-flow__resize-control, .react-flow__handle') !== null;

/**
 * The `canvasNode` renderer (F07 FR-009 – FR-011): one of six shapes, a centred label and four handles. Memoised so
 * a change to one node does not re-render the others (NFR-004). F08 adds the resizer and the inline label editor
 * (double-click, or Enter on the focused node); editing state is local and never synced.
 */
function CanvasNodeImpl({ id, data, selected, isConnectable }: NodeProps<CanvasNodeType>) {
  const { shape, color } = knownVisuals(id, data);
  const { canEdit, updateNodeData } = useCanvasMutations();
  const [editing, setEditing] = useState(false);
  // Losing write access (EC-010) closes the editor; its unmount guard skips the commit.
  if (editing && !canEdit) setEditing(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // React Flow focuses the node wrapper (`.react-flow__node`), an ancestor of this component, so Enter is read there.
  useEffect(() => {
    const wrapper = rootRef.current?.closest<HTMLElement>('.react-flow__node');
    if (!wrapper || !canEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target !== wrapper || e.repeat) return;
      e.preventDefault();
      setEditing(true);
    };
    wrapper.addEventListener('keydown', onKeyDown);
    return () => wrapper.removeEventListener('keydown', onKeyDown);
  }, [canEdit]);

  const commit = (value: string) => {
    const label = value.trim();
    if (label !== data.label) updateNodeData(id, { label });
    setEditing(false);
  };

  return (
    <div
      ref={rootRef}
      aria-label={`${shape} ${data.label || 'unlabelled'}`}
      className="h-full w-full"
      onDoubleClick={(e) => {
        if (canEdit && !onControl(e.target)) setEditing(true);
      }}
    >
      {selected && canEdit ? <CanvasNodeResizer shape={shape} /> : null}
      <ShapeRenderer shape={shape} color={color} selected={selected}>
        <NodeLabel label={data.label} showPlaceholder={canEdit} hidden={editing} />
        {editing ? <NodeLabelEditor initial={data.label} onCommit={commit} onCancel={() => setEditing(false)} /> : null}
      </ShapeRenderer>
      <NodeHandles isConnectable={isConnectable} />
    </div>
  );
}

export const CanvasNode = memo(CanvasNodeImpl);
