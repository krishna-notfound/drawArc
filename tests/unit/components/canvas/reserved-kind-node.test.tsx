import { fireEvent, render, screen } from '@testing-library/react';
import { type NodeChange, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { nodeTypes } from '@/components/canvas/node-types';
import type { CanvasNode } from '@/types/canvas';

// F22 AC-017: reserved kinds render a placeholder, unknown shapes fall back to a rectangle, hex colours resolve.

beforeAll(() => {
  // React Flow measures nodes and sets up d3-zoom; jsdom has neither DOMMatrixReadOnly nor layout.
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
    constructor() {}
  } as unknown as typeof DOMMatrixReadOnly;
});

afterEach(() => vi.restoreAllMocks());

const base = { type: 'canvasNode', position: { x: 0, y: 0 }, width: 180, height: 80 } as const;
const frameNode: CanvasNode = {
  ...base,
  id: 'frame_01JBE0000000000000000000R1',
  data: { label: '', shape: 'frame', color: 'neutral', clip: false },
};
const imageNode: CanvasNode = {
  ...base,
  id: 'image_01JBE0000000000000000000R2',
  data: {
    label: '',
    shape: 'image',
    color: 'neutral',
    image: { fileId: 'file_01', status: 'saved', natural: { width: 800, height: 600 } },
  },
};

function renderCanvas(nodes: CanvasNode[]) {
  const onNodesChange = vi.fn<(changes: NodeChange<CanvasNode>[]) => void>();
  const view = render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow<CanvasNode> nodes={nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange} />
      </div>
    </ReactFlowProvider>,
  );
  return { ...view, onNodesChange };
}

describe('kind dispatch (F22 FR-018)', () => {
  it('renders frame and image as a deletable placeholder with no handles and no editor (AC-017)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, onNodesChange } = renderCanvas([frameNode, imageNode]);
    for (const id of [frameNode.id, imageNode.id]) {
      const wrapper = container.querySelector(`.react-flow__node[data-id="${id}"]`)!;
      expect(wrapper).toHaveTextContent('Not supported in this version');
      expect(wrapper.querySelectorAll('.react-flow__handle')).toHaveLength(0);
      fireEvent.doubleClick(wrapper.firstElementChild!);
      expect(screen.queryByRole('textbox', { name: 'Node label' })).toBeNull();
    }
    expect(container.querySelector(`[data-id="${frameNode.id}"]`)).toHaveTextContent('frame');
    expect(warn).toHaveBeenCalledTimes(2);
    // Selectable, so it can be deleted with the keyboard like any node.
    fireEvent.click(container.querySelector(`.react-flow__node[data-id="${frameNode.id}"]`)!);
    expect(onNodesChange).toHaveBeenCalledWith([expect.objectContaining({ type: 'select', id: frameNode.id, selected: true })]);
  });

  it('renders an unknown shape string as a rectangle with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zigzag = {
      ...base,
      id: 'rectangle_01JBE0000000000000000000R3',
      data: { label: 'z', shape: 'zigzag', color: 'neutral' },
    } as unknown as CanvasNode;
    const { container, rerender } = renderCanvas([zigzag]);
    expect(container.querySelector('[aria-label="rectangle z"]')).not.toBeNull();
    rerender(
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow<CanvasNode> nodes={[{ ...zigzag }]} nodeTypes={nodeTypes} />
        </div>
      </ReactFlowProvider>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('renders a hex colour on a shape through resolveColor (Review Focus 4)', () => {
    const rect: CanvasNode = {
      ...base,
      id: 'rectangle_01JBE0000000000000000000R4',
      data: { label: 'x', shape: 'rectangle', color: '#FDE68A' },
    };
    const { container } = renderCanvas([rect]);
    const box = container.querySelector<HTMLElement>('[data-shape="rectangle"]')!;
    expect(box.style.background).toMatch(/#FDE68A|rgb\(253, 230, 138\)/i);
    expect(box.style.color).toMatch(/#000000|rgb\(0, 0, 0\)/);
  });
});
