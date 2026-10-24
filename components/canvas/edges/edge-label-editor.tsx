'use client';

import { type ChangeEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { EDGE_LABEL_MAX_LENGTH } from '@/types/canvas';

export interface EdgeLabelEditorProps {
  /** The current label (`data.label ?? ''`). */
  initial: string;
  /** Called once with the normalised value when the edit commits (Enter or blur). */
  onCommit(value: string): void;
  /** Called once when the edit is discarded (Escape). */
  onCancel(): void;
}

/** Single line, at most 100 characters (FR-007, EC-007). */
const normalise = (value: string) => value.replace(/\s*[\r\n]+\s*/g, ' ').slice(0, EDGE_LABEL_MAX_LENGTH);

/**
 * Inline edge label input (F09 FR-006, FR-007): grows with its content from 4ch to 24ch, opens with the text
 * selected, Enter / blur commit, Escape discards. Key events never reach the pane or window shortcuts; an unmount
 * while open (the edge was deleted) never commits.
 */
export function EdgeLabelEditor({ initial, onCommit, onCancel }: EdgeLabelEditorProps) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  // Layout cleanup runs before the input leaves the DOM, so a blur fired by the removal is ignored. The setup
  // re-arms it: Strict Mode runs mount → cleanup → mount in development.
  useLayoutEffect(() => {
    finished.current = false;
    return () => {
      finished.current = true;
    };
  }, []);

  const finish = (commit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (commit) onCommit(normalise(value).trim());
    else onCancel();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  };

  return (
    <input
      ref={input}
      type="text"
      aria-label="Edge label"
      placeholder="Label"
      maxLength={EDGE_LABEL_MAX_LENGTH}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(normalise(event.target.value))}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => event.stopPropagation()}
      onBlur={() => finish(true)}
      style={{ width: `${Math.min(Math.max(value.length, 4), 24)}ch` }}
      className="nodrag nopan nowheel box-content rounded-xl border border-brand bg-elevated px-2 py-0.5 text-xs text-copy-primary outline-none"
    />
  );
}
