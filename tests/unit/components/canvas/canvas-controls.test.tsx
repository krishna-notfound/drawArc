import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CanvasControls, type CanvasControlsProps } from '@/components/canvas/canvas-controls';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ariaKeyShortcuts } from '@/lib/canvas/registry';

vi.mock('@liveblocks/react/suspense', () => ({
  useRoom: () => ({ events: { history: { subscribe: () => () => {} } }, history: { canUndo: () => false, canRedo: () => false } }),
}));

type Store = ReturnType<typeof useStoreApi>;

function renderBar({ canEdit }: { canEdit: boolean }) {
  const actions = {
    canEdit,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    toggleGrid: vi.fn(),
    resetZoom: vi.fn(),
  } satisfies CanvasControlsProps['actions'];
  let store!: Store;
  const Probe = (): ReactNode => {
    store = useStoreApi();
    return null;
  };
  render(
    <TooltipProvider>
      <ReactFlowProvider>
        <Probe />
        <CanvasControls actions={actions} platform="other" />
      </ReactFlowProvider>
    </TooltipProvider>,
  );
  return { actions, store };
}

describe('CanvasControls (F10 v2 AC-026, AC-035, AC-040)', () => {
  it('renders the v2 order, hints and aria-keyshortcuts from the registry for an editor (AC-026, FR-024 UX)', () => {
    renderBar({ canEdit: true });
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Zoom out',
      'Zoom 100 %, reset to 100 %',
      'Zoom in',
      'Fit view',
      'Grid',
      'Undo',
      'Redo',
    ]);
    for (const [label, action] of [
      ['Zoom out', 'zoomOut'],
      ['Zoom in', 'zoomIn'],
      ['Fit view', 'fitView'],
      ['Grid', 'toggleGrid'],
      ['Undo', 'undo'],
      ['Redo', 'redo'],
    ] as const) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-keyshortcuts', ariaKeyShortcuts(action));
    }
    expect(screen.getByRole('button', { name: /reset to 100 %/ })).not.toHaveAttribute('aria-keyshortcuts');
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a viewer gets the first five controls including a working Grid toggle (AC-035)', async () => {
    const { actions } = renderBar({ canEdit: false });
    expect(screen.getAllByRole('button')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(actions.toggleGrid).toHaveBeenCalledOnce();
  });

  it('readout follows the zoom, resets on click, and the limit buttons disable at 4 and 0.1 (AC-040 unit, EC-025)', async () => {
    const { actions, store } = renderBar({ canEdit: true });
    act(() => store.setState({ transform: [0, 0, 4], minZoom: 0.1, maxZoom: 4 }));
    expect(screen.getByRole('button', { name: 'Zoom 400 %, reset to 100 %' })).toHaveTextContent('400 %');
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    act(() => store.setState({ transform: [0, 0, 0.1] }));
    expect(screen.getByRole('button', { name: 'Zoom 10 %, reset to 100 %' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /reset to 100 %/ }));
    expect(actions.resetZoom).toHaveBeenCalledOnce();
  });
});
