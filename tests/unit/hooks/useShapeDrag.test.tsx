import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ShapeDragOptions, useShapeDrag } from '@/hooks/useShapeDrag';

// Pointer gestures from a palette button (F07 AC-003, AC-005, AC-006). jsdom has no layout, pointer capture or
// elementFromPoint, so those are stubbed; `under` is what the pointer is over.
let under: Element | null = null;
const capture = { set: vi.fn(), release: vi.fn() };

function Harness(props: ShapeDragOptions) {
  const { drag, buttonProps } = useShapeDrag(props);
  return (
    <>
      <button type="button" {...buttonProps('hexagon')}>
        hexagon
      </button>
      {drag ? <div data-testid="ghost" data-x={drag.x} data-w={drag.width} /> : null}
    </>
  );
}

function setup() {
  const container = document.createElement('div');
  container.className = 'react-flow';
  container.innerHTML = '<div class="react-flow__pane"><div id="in-pane"></div></div>';
  document.body.append(container);
  const options = { getContainer: () => container, getZoom: () => 1.5, onDrop: vi.fn(), onPlace: vi.fn() };
  render(<Harness {...options} />);
  return { options, button: screen.getByRole('button'), pane: container.querySelector('#in-pane')! };
}

const at = (x: number, y: number, extra: object = {}) => ({ pointerId: 7, isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });

async function flushFrame() {
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
}

beforeEach(() => {
  let captured = false;
  HTMLElement.prototype.setPointerCapture = vi.fn(() => {
    captured = true;
    capture.set();
  });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => captured);
  HTMLElement.prototype.releasePointerCapture = vi.fn(() => {
    captured = false;
    capture.release();
  });
  document.elementFromPoint = () => under;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  capture.set.mockClear();
  capture.release.mockClear();
  under = null;
});

describe('useShapeDrag', () => {
  it('starts a drag only after 4 px with the primary button, and drops over the pane at the pointer', async () => {
    const { options, button, pane } = setup();
    under = pane;

    fireEvent.pointerDown(button, at(100, 100, { button: 2 }));
    fireEvent.pointerMove(button, at(120, 100));
    await flushFrame();
    expect(screen.queryByTestId('ghost')).toBeNull();
    expect(capture.set).not.toHaveBeenCalled();

    fireEvent.pointerDown(button, at(100, 100));
    expect(capture.set).toHaveBeenCalledOnce();
    fireEvent.pointerMove(button, at(103, 100));
    await flushFrame();
    expect(screen.queryByTestId('ghost')).toBeNull();
    fireEvent.pointerMove(button, at(104, 100));
    await flushFrame();
    // Sized to the shape at the current zoom: hexagon 160 × 1.5.
    expect(screen.getByTestId('ghost')).toHaveAttribute('data-w', '240');

    fireEvent.pointerUp(button, at(400, 300));
    fireEvent.click(button); // the browser's click after a captured drag must not also place a shape
    expect(options.onDrop).toHaveBeenCalledExactlyOnceWith('hexagon', { x: 400, y: 300 });
    expect(options.onPlace).not.toHaveBeenCalled();
    expect(capture.release).toHaveBeenCalled();
    expect(screen.queryByTestId('ghost')).toBeNull();
  });

  it.each([
    ['released outside the pane', (button: HTMLElement) => fireEvent.pointerUp(button, at(5, 5))],
    ['pointercancel', (button: HTMLElement) => fireEvent.pointerCancel(button, at(200, 200))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['window blur', () => fireEvent.blur(window)],
  ])('cancels without creating anything when %s', async (_name, finish) => {
    const { options, button, pane } = setup();
    under = pane;
    fireEvent.pointerDown(button, at(100, 100));
    fireEvent.pointerMove(button, at(200, 200));
    await flushFrame();
    expect(screen.getByTestId('ghost')).toBeInTheDocument();

    under = document.body; // e.g. the sidebar
    finish(button);
    // Whatever follows the cancel — even a release over the pane, and the browser's click — creates nothing.
    under = pane;
    fireEvent.pointerUp(button, at(200, 200));
    fireEvent.click(button);
    await flushFrame();

    expect(screen.queryByTestId('ghost')).toBeNull();
    expect(capture.release).toHaveBeenCalled();
    expect(options.onDrop).not.toHaveBeenCalled();
    expect(options.onPlace).not.toHaveBeenCalled();
  });

  it('a click without movement, or Enter, places the shape (FR-007)', () => {
    const { options, button } = setup();
    fireEvent.pointerDown(button, at(100, 100));
    fireEvent.pointerUp(button, at(101, 100));
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button, { detail: 0 });
    expect(options.onPlace).toHaveBeenCalledTimes(2);
    expect(options.onDrop).not.toHaveBeenCalled();
  });
});
