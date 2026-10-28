'use client';

import type { NodeProps } from '@xyflow/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { resolveColor } from '@/lib/canvas/color';
import { STICKY_PADDING } from '@/lib/canvas/text-measure';
import { effectiveText, textStyle } from '@/lib/canvas/text-style';
import { type CanvasNode as CanvasNodeType, TEXT_MAX_LENGTH } from '@/types/canvas';

import { onControl, useEnterToEdit } from './node-editing';
import { NodeHandles } from './node-handles';
import { NodeLabel } from './node-label';
import { NodeLabelEditor } from './node-label-editor';
import { CanvasNodeResizer } from './node-resizer';
import { useTextMeasure } from './text-measure-context';

const ALIGN_ITEMS = { top: 'items-start', middle: 'items-center', bottom: 'items-end' } as const;

/**
 * The sticky note (F22 FR-014, FR-015): a filled `rounded-[4px]` card with four handles, the F08 resizer (75 px
 * minimum) and wrapping text. Committing a label that is taller than the card raises its height in the same
 * `replace` (never shrinks); anything beyond is clipped. Stickies are never auto-deleted. The 2 px border plus
 * 10 px padding make the 12 px text inset that `STICKY_PADDING` measures.
 */
export function StickyNode({ id, data, selected, isConnectable, width, height }: NodeProps<CanvasNodeType>) {
  const { canEdit, commitTextNode } = useCanvasMutations();
  const measure = useTextMeasure();
  const text = effectiveText('sticky', data);
  const style = textStyle(text);
  const colors = resolveColor(data.color);

  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ label: data.label, width: width ?? 0, height: height ?? 0 });
  useLayoutEffect(() => {
    latest.current = { label: data.label, width: width ?? 0, height: height ?? 0 };
  });
  // Losing write access (EC-010) closes the editor; its unmount guard skips the commit.
  if (editing && !canEdit) setEditing(false);

  useEnterToEdit(rootRef, canEdit, useCallback(() => setEditing(true), []));

  const commit = (value: string) => {
    const label = value.trim();
    setEditing(false);
    void (async () => {
      const before = latest.current;
      const size = await measure({ text: label, style, padding: STICKY_PADDING, width: before.width });
      const now = latest.current;
      const grown = Math.max(now.height, size.height);
      // An unchanged label that still fits writes nothing (no Storage write, no undo entry).
      if (label === now.label && grown === now.height) return;
      commitTextNode(id, { label, ...(grown !== now.height ? { height: grown } : {}) });
    })();
  };

  const typography = 'block w-full font-sans break-words';
  const labelStyle = { ...style, whiteSpace: 'pre-wrap' } as const;

  return (
    <div
      ref={rootRef}
      aria-label={`sticky note ${data.label || 'unlabelled'}`}
      data-kind="sticky"
      className="canvas-sticky-node relative h-full w-full"
      style={{
        backgroundColor: colors.fill,
        color: colors.text,
        borderRadius: 4,
        border: selected ? '2px solid var(--accent-primary)' : '2px solid transparent',
      }}
      onDoubleClick={(e) => {
        if (canEdit && !onControl(e.target)) setEditing(true);
      }}
    >
      {/* The clip box is inside the root so the handles, half outside the card, are never clipped. */}
      <div className={`absolute inset-0 flex overflow-hidden rounded-[2px] p-2.5 ${ALIGN_ITEMS[text.valign]}`}>
        <NodeLabel
          label={data.label}
          showPlaceholder={canEdit}
          hidden={editing}
          style={labelStyle}
          className={typography}
        />
      </div>
      {editing ? (
        <NodeLabelEditor
          initial={data.label}
          onCommit={commit}
          onCancel={() => setEditing(false)}
          style={labelStyle}
          maxLength={TEXT_MAX_LENGTH}
          className={typography}
          wrapperClassName={`absolute inset-0 flex p-2.5 ${ALIGN_ITEMS[text.valign]}`}
        />
      ) : null}
      {/* After the clip box in the DOM, so its absolutely positioned layer never covers the controls. */}
      {selected && canEdit ? <CanvasNodeResizer kind="sticky" /> : null}
      <NodeHandles isConnectable={isConnectable} />
    </div>
  );
}
