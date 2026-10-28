import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { useEffect } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShapePalette } from '@/components/canvas/shape-palette';
import { TooltipProvider } from '@/components/ui/tooltip';

// F22 AC-007: the palette gains text and sticky after the six shapes, placed through addNodeOfKind.

const addNode = vi.fn(() => null);
const addNodeOfKind = vi.fn(() => null);
vi.mock('@/hooks/useCanvasMutations', () => ({ useCanvasMutations: () => ({ canEdit: true, addNode, addNodeOfKind }) }));

/** Gives the store a 800 x 600 canvas element at the origin, as `getBoundingClientRect` would on a real layout. */
function StubDomNode() {
  const store = useStoreApi();
  useEffect(() => {
    const domNode = document.createElement('div');
    domNode.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
    store.setState({ domNode });
  }, [store]);
  return null;
}

function renderPalette() {
  return render(
    <TooltipProvider>
      <ReactFlowProvider>
        <StubDomNode />
        <ShapePalette />
      </ReactFlowProvider>
    </TooltipProvider>,
  );
}

beforeAll(() => {
  // jsdom has no pointer capture; the drag hook calls it on pointerdown.
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  addNode.mockClear();
  addNodeOfKind.mockClear();
});

describe('ShapePalette (F22 FR-007)', () => {
  it('shows eight items in order, the last two for text and sticky, after a divider', () => {
    renderPalette();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add rectangle',
      'Add diamond',
      'Add circle',
      'Add pill',
      'Add cylinder',
      'Add hexagon',
      'Add text',
      'Add sticky note',
    ]);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('clicking "Add text" calls addNodeOfKind at the viewport centre, top-left adjusted for 24x20', async () => {
    renderPalette();
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    expect(addNodeOfKind).toHaveBeenCalledWith('text', { x: 400 - 12, y: 300 - 10 });
    expect(addNode).not.toHaveBeenCalled();
  });

  it('clicking a shape still goes through addNode', async () => {
    renderPalette();
    await userEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(addNode).toHaveBeenCalledWith('circle', { x: 400 - 48, y: 300 - 48 });
    expect(addNodeOfKind).not.toHaveBeenCalled();
  });
});
