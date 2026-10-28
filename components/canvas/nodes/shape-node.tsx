'use client';

import type { NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { effectiveText, textStyle } from '@/lib/canvas/text-style';
import type { CanvasNode as CanvasNodeType, NodeShape } from '@/types/canvas';

import { NodeHandles } from './node-handles';
import { NodeLabel } from './node-label';
import { NodeLabelEditor } from './node-label-editor';
import { CanvasNodeResizer } from './node-resizer';
import { ShapeRenderer } from './shape-renderer';

/** A double-click on a resize control or connection handle is not a request to edit the label. */
const onControl = (target: EventTarget) =>
  target instanceof Element && target.closest('.react-flow__resize-control, .react-flow__handle') !== null;

/**
 * The renderer of the six drawn shapes (F07 FR-009 – FR-011): a centred label and four handles. F08 adds the
 * resizer and the inline label editor (double-click, or Enter on the focused node); editing state is local and
 * never synced. The label's typography follows `data.text` (defaults equal the F08 look).
 */
export function ShapeNode({ id, data, selected, isConnectable, shape }: NodeProps<CanvasNodeType> & { shape: NodeShape }) {
  const { canEdit, updateNodeData } = useCanvasMutations();
  const [editing, setEditing] = useState(false);
  // Losing write access (EC-010) closes the editor; its unmount guard skips the commit.
  if (editing && !canEdit) setEditing(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const style = textStyle(effectiveText(shape, data));

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
      <ShapeRenderer shape={shape} color={data.color} selected={selected}>
        <NodeLabel label={data.label} showPlaceholder={canEdit} hidden={editing} style={style} />
        {editing ? (
          <NodeLabelEditor initial={data.label} onCommit={commit} onCancel={() => setEditing(false)} style={style} />
        ) : null}
      </ShapeRenderer>
      <NodeHandles isConnectable={isConnectable} />
    </div>
  );
}
