'use client';

import { type NodeProps, type OnResizeEnd, useStoreApi } from '@xyflow/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useCanvasMutations } from '@/hooks/useCanvasMutations';
import { isHexColor, resolveColor } from '@/lib/canvas/color';
import { takeEditorOpen } from '@/lib/canvas/pending-editor';
import { TEXT_PADDING } from '@/lib/canvas/text-measure';
import { effectiveText, textStyle } from '@/lib/canvas/text-style';
import type { CanvasEdge, CanvasNode as CanvasNodeType } from '@/types/canvas';
import { TEXT_MAX_LENGTH } from '@/types/canvas';

import { onControl, useEnterToEdit } from './node-editing';
import { NodeLabel } from './node-label';
import { NodeLabelEditor } from './node-label-editor';
import { CanvasNodeResizer } from './node-resizer';
import { useTextMeasure } from './text-measure-context';

interface Size {
  width: number;
  height: number;
}

/**
 * The borderless text node (F22 FR-009 – FR-013): no fill, no border, no handles. While `autoWidth` the content never
 * wraps and every commit stores the measured size, so collaborators render the node without measuring; a side
 * resize makes the width fixed and the text wrap. Editing reuses `NodeLabelEditor` (Enter commits, Shift+Enter
 * newline, Esc cancels, blur commits). An empty commit, or Esc on a node that never had text, deletes the node.
 */
export function TextNode({ id, data, selected, width, height }: NodeProps<CanvasNodeType>) {
  const { canEdit, commitTextNode, onDelete } = useCanvasMutations();
  const store = useStoreApi<CanvasNodeType, CanvasEdge>();
  const measure = useTextMeasure();
  const autoWidth = data.shape === 'text' ? data.autoWidth : true;
  const style = textStyle(effectiveText('text', data));
  const textColor = isHexColor(data.color) ? data.color : resolveColor(data.color).text;

  // The creator's editor opens on mount (flag set by `addNodeOfKind`); read once, in the state initialiser.
  const [editing, setEditing] = useState(() => canEdit && takeEditorOpen(id));
  // Local-only growth while typing: auto-width grows both ways, fixed width only in height.
  const [draftSize, setDraftSize] = useState<Size | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const neverHadText = useRef(data.label === '');
  const draftSeq = useRef(0);
  const latest = useRef({ label: data.label, autoWidth, width: width ?? 0, height: height ?? 0 });
  useLayoutEffect(() => {
    latest.current = { label: data.label, autoWidth, width: width ?? 0, height: height ?? 0 };
  });
  // Losing write access (EC-010) closes the editor; its unmount guard skips the commit.
  if (editing && !canEdit) setEditing(false);

  const open = useCallback(() => {
    neverHadText.current = latest.current.label === '';
    setEditing(true);
  }, []);
  useEnterToEdit(rootRef, canEdit, open);

  const close = () => {
    draftSeq.current++; // a measurement still in flight must not resurrect the draft size
    setEditing(false);
    setDraftSize(null);
  };

  /** Deletes through the collaborative `onDelete`; a node removed remotely meanwhile is a no-op (EC-009). */
  const deleteSelf = () => {
    const node = store.getState().nodeLookup.get(id)?.internals.userNode;
    if (node) onDelete({ nodes: [node], edges: [] });
  };

  const commit = (value: string) => {
    const label = value.trim();
    close();
    if (label === '') {
      deleteSelf();
      return;
    }
    neverHadText.current = false;
    void (async () => {
      const before = latest.current;
      const size = await measure({
        text: label,
        style,
        padding: TEXT_PADDING,
        width: before.autoWidth ? undefined : before.width,
      });
      const next = { width: before.autoWidth ? size.width : before.width, height: size.height };
      const now = latest.current;
      // Re-committing an unchanged label at an unchanged size writes nothing (no Storage write, no undo entry).
      if (label === now.label && next.width === now.width && next.height === now.height) return;
      commitTextNode(id, { label, ...next });
    })();
  };

  const cancel = () => {
    close();
    if (neverHadText.current) deleteSelf();
  };

  const onDraftChange = (value: string) => {
    const seq = ++draftSeq.current;
    void measure({
      text: value,
      style,
      padding: TEXT_PADDING,
      width: latest.current.autoWidth ? undefined : latest.current.width,
    }).then((size) => {
      if (seq === draftSeq.current) setDraftSize(size);
    });
  };

  const onResizeEnd: OnResizeEnd = (_event, params) => {
    void (async () => {
      const size = await measure({ text: latest.current.label, style, padding: TEXT_PADDING, width: params.width });
      commitTextNode(id, {
        autoWidth: false,
        width: params.width,
        height: size.height,
        position: { x: params.x, y: params.y },
      });
    })();
  };

  const whiteSpace = autoWidth ? 'pre' : 'pre-wrap';
  const labelStyle = { ...style, whiteSpace } as const;
  const typography = autoWidth ? 'block px-1.5 py-1 font-sans overflow-visible' : 'block px-1.5 py-1 font-sans break-words';

  return (
    <div
      ref={rootRef}
      aria-label={`text ${data.label || 'empty'}`}
      data-kind="text"
      className="canvas-text-node relative h-full w-full"
      style={{
        color: textColor,
        minWidth: editing && autoWidth ? draftSize?.width : undefined,
        minHeight: editing ? draftSize?.height : undefined,
      }}
      onDoubleClick={(e) => {
        if (canEdit && !onControl(e.target)) open();
      }}
    >
      {selected && canEdit ? <CanvasNodeResizer kind="text" sides="horizontal" onResizeEnd={onResizeEnd} /> : null}
      <NodeLabel
        label={data.label}
        showPlaceholder={canEdit}
        hidden={editing}
        style={labelStyle}
        className={typography}
        placeholder="Text"
      />
      {editing ? (
        <NodeLabelEditor
          initial={data.label}
          onCommit={commit}
          onCancel={cancel}
          style={labelStyle}
          maxLength={TEXT_MAX_LENGTH}
          className={typography}
          wrapperClassName="absolute inset-0"
          placeholder="Text"
          onDraftChange={onDraftChange}
        />
      ) : null}
    </div>
  );
}
