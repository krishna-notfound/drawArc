'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { LABEL_MAX_LENGTH } from '@/types/canvas';

import { LABEL_TYPOGRAPHY } from './node-label';

export interface NodeLabelEditorProps {
  initial: string;
  /** Called at most once, with the raw draft (Enter or blur). The caller trims and skips unchanged labels. */
  onCommit(value: string): void;
  /** Called at most once (Escape); nothing is written. */
  onCancel(): void;
}

const stop = (e: Event) => e.stopPropagation();

/**
 * Inline label editor (F08 FR-006 – FR-008, FR-010, D-08a): a textarea over the label, buffering a local draft that is
 * written once on commit. Enter commits, Shift+Enter inserts a newline, Escape cancels, blur commits. Enter and Escape
 * return focus to the node. If the editor unmounts for any other reason (node deleted remotely, role downgraded), it
 * closes without committing.
 */
export function NodeLabelEditor({ initial, onCommit, onCancel }: NodeLabelEditorProps) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const callbacks = useRef({ onCommit, onCancel });
  // Set once the editor has finished (commit, cancel or unmount); a later blur — e.g. the browser blurring a removed
  // or refocused textarea — is then ignored.
  const done = useRef(false);

  useLayoutEffect(() => {
    callbacks.current = { onCommit, onCancel };
  });

  // Layout cleanup runs before React removes the DOM node, so a blur caused by the removal itself never commits.
  // The setup re-arms the editor after Strict Mode's simulated unmount/remount in development.
  useLayoutEffect(() => {
    done.current = false;
    return () => {
      done.current = true;
    };
  }, []);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.select();

    // Native listeners on the textarea itself (FR-008): React's synthetic stopPropagation acts only at the React
    // root, after native listeners on the node, the pane and the document (React Flow, Liveblocks, F10) have run.
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        finish(textarea, () => callbacks.current.onCommit(textarea.value), true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(textarea, () => callbacks.current.onCancel(), true);
      }
    };
    textarea.addEventListener('keydown', onKeyDown);
    textarea.addEventListener('keyup', stop);
    textarea.addEventListener('keypress', stop);
    return () => {
      textarea.removeEventListener('keydown', onKeyDown);
      textarea.removeEventListener('keyup', stop);
      textarea.removeEventListener('keypress', stop);
    };
  }, []);

  function finish(textarea: HTMLTextAreaElement, action: () => void, refocusNode: boolean) {
    if (done.current) return;
    done.current = true;
    const node = refocusNode ? textarea.closest<HTMLElement>('.react-flow__node') : null;
    action();
    node?.focus();
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <textarea
        ref={ref}
        aria-label="Node label"
        placeholder="Label"
        rows={1}
        maxLength={LABEL_MAX_LENGTH}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => finish(e.currentTarget, () => callbacks.current.onCommit(e.currentTarget.value), false)}
        className={`nodrag nowheel nopan field-sizing-content max-h-full w-full resize-none overflow-auto bg-transparent outline-none placeholder:text-copy-faint ${LABEL_TYPOGRAPHY}`}
      />
    </div>
  );
}
