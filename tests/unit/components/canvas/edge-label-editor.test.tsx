import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EdgeLabelEditor } from '@/components/canvas/edges/edge-label-editor';

function open(initial = 'HTTPS') {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  // Strict Mode, as in `next dev`: effects run mount → cleanup → mount.
  const view = render(
    <StrictMode>
      <EdgeLabelEditor initial={initial} onCommit={onCommit} onCancel={onCancel} />
    </StrictMode>,
  );
  const input = screen.getByRole('textbox', { name: 'Edge label' }) as HTMLInputElement;
  return { onCommit, onCancel, input, view };
}

const windowKeys: string[] = [];
const recordKey = (event: KeyboardEvent) => windowKeys.push(event.key);
beforeEach(() => {
  windowKeys.length = 0;
  window.addEventListener('keydown', recordKey);
});
afterEach(() => window.removeEventListener('keydown', recordKey));

describe('EdgeLabelEditor (F09 AC-012, AC-013, EC-007)', () => {
  it('opens focused with the label selected, capped at 100, isolated from canvas gestures, growing 4ch → 24ch', () => {
    const { input } = open();
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    expect(input.maxLength).toBe(100);
    expect(input.className).toMatch(/\bnodrag\b.*\bnopan\b.*\bnowheel\b/);
    expect(input.style.width).toBe('5ch');
    fireEvent.change(input, { target: { value: 'x'.repeat(30) } });
    expect(input.style.width).toBe('24ch');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.style.width).toBe('4ch');
  });

  it('Enter commits the trimmed value once; Escape discards', () => {
    const enter = open();
    fireEvent.change(enter.input, { target: { value: '  events ' } });
    fireEvent.keyDown(enter.input, { key: 'Enter' });
    fireEvent.blur(enter.input);
    expect(enter.onCommit).toHaveBeenCalledExactlyOnceWith('events');
    enter.view.unmount();

    const escape = open();
    fireEvent.change(escape.input, { target: { value: 'nope' } });
    fireEvent.keyDown(escape.input, { key: 'Escape' });
    fireEvent.blur(escape.input);
    expect(escape.onCommit).not.toHaveBeenCalled();
    expect(escape.onCancel).toHaveBeenCalledOnce();
  });

  it('blur commits; a pasted multi-line 500-character value becomes one line of 100', () => {
    const { input, onCommit } = open('');
    fireEvent.change(input, { target: { value: `${'a'.repeat(250)}\n${'b'.repeat(250)}` } });
    expect(input.value).toHaveLength(100);
    expect(input.value).not.toContain('\n');
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('a'.repeat(100));
  });

  it('keys typed in the input never reach window shortcuts (Backspace, Delete, +, Ctrl+Z)', () => {
    const { input } = open();
    for (const key of ['Backspace', 'Delete', '+', 'z']) fireEvent.keyDown(input, { key, ctrlKey: key === 'z' });
    expect(windowKeys).toEqual([]);
  });

  it('unmounting while open (the edge was deleted) never commits', () => {
    const { input, onCommit, onCancel, view } = open();
    fireEvent.change(input, { target: { value: 'changed' } });
    act(() => view.unmount());
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
