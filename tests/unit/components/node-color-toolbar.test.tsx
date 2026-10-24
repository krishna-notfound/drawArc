import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type NodeChange, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { NodeColorToolbar } from '@/components/canvas/node-color-toolbar';
import { nodeTypes } from '@/components/canvas/node-types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type CanvasNode, NODE_COLOR_IDS, type NodeColorId } from '@/types/canvas';

// F08 colour toolbar: radiogroup structure and active/mixed state (AC-015), roving keyboard focus (AC-018), and
// the read-only / empty-selection gate.

beforeAll(() => {
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
  } as unknown as typeof DOMMatrixReadOnly;
});

const node = (n: number, color: NodeColorId, selected = true): CanvasNode => ({
  id: `rectangle_0${n}`,
  type: 'canvasNode',
  position: { x: n * 200, y: 0 },
  width: 180,
  height: 80,
  selected,
  data: { label: '', shape: 'rectangle', color },
});

function renderToolbar(nodes: CanvasNode[], canEdit = true) {
  const onNodesChange = vi.fn<(changes: NodeChange<CanvasNode>[]) => void>();
  render(
    <TooltipProvider>
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow<CanvasNode>
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={canEdit ? onNodesChange : undefined}
            nodesDraggable={canEdit}
          >
            <NodeColorToolbar />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </TooltipProvider>,
  );
  return { onNodesChange };
}

const group = () => screen.queryByRole('radiogroup', { name: 'Node colour' });

describe('NodeColorToolbar (F08)', () => {
  it('shows eight swatches in palette order with the shared colour checked; mixed shows none (AC-015)', () => {
    renderToolbar([node(1, 'blue'), node(2, 'blue')]);
    const radios = within(group()!).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(NODE_COLOR_IDS.map((id) => `Colour: ${id}`));
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true')).toEqual([screen.getByRole('radio', { name: 'Colour: blue' })]);
    expect(screen.getByRole('radio', { name: 'Colour: blue' }).querySelector('svg')).not.toBeNull();
    expect(group()!.closest('.react-flow__node-toolbar')).toHaveClass('nodrag', 'nopan');
  });

  it('is absent with no selection (AC-015)', () => {
    renderToolbar([node(1, 'blue', false)]);
    expect(group()).toBeNull();
  });

  it('is absent for a read-only member (AC-015, FR-013)', () => {
    renderToolbar([node(1, 'blue')], false);
    expect(group()).toBeNull();
  });

  it('roves focus with wrapping arrows and Home/End; Space applies to every selected node at once (AC-018, AC-017)', async () => {
    const user = userEvent.setup();
    const { onNodesChange } = renderToolbar([node(1, 'neutral'), node(2, 'blue'), node(3, 'blue')]);
    // Mixed selection: nothing checked, the first swatch is the single tab stop.
    expect(within(group()!).getAllByRole('radio').filter((r) => r.tabIndex === 0)).toHaveLength(1);
    const neutral = screen.getByRole('radio', { name: 'Colour: neutral' });
    expect(neutral.tabIndex).toBe(0);
    act(() => neutral.focus());

    for (let i = 0; i < NODE_COLOR_IDS.length; i++) await user.keyboard('{ArrowRight}');
    expect(neutral).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Colour: teal' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(neutral).toHaveFocus();
    await user.keyboard('{End}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Colour: green' })).toHaveFocus();

    onNodesChange.mockClear();
    await user.keyboard(' ');
    expect(onNodesChange).toHaveBeenCalledTimes(1);
    const [changes] = onNodesChange.mock.calls[0]!;
    expect(changes.map((c) => (c.type === 'replace' ? [c.id, c.item.data.color] : c.type))).toEqual([
      ['rectangle_01', 'green'],
      ['rectangle_02', 'green'],
      ['rectangle_03', 'green'],
    ]);
  });
});
