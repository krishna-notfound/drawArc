import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type NodeChange, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { nodeTypes } from '@/components/canvas/node-types';
import { TextMeasureContext } from '@/components/canvas/nodes/text-measure-context';
import type { CanvasNode } from '@/types/canvas';

// F22 sticky note through the real renderer inside a real React Flow store: look (AC-014), auto-grow on commit
// (AC-015), never auto-deleted, Enter on the wrapper (Review Focus 5) and the viewer gate.

beforeAll(() => {
  // React Flow measures nodes and sets up d3-zoom; jsdom has neither DOMMatrixReadOnly nor layout.
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
    constructor() {}
  } as unknown as typeof DOMMatrixReadOnly;
});

const ID = 'sticky_01JBE0000000000000000000S1';
// 400 px of content for a long label, 100 px for a short one, plus the vertical padding like the real measurer.
const measure = vi.fn(async ({ text, padding }: { text: string; padding: { x: number; y: number } }) => ({
  width: 250,
  height: (text.length > 20 ? 400 : 100) + 2 * padding.y,
}));

beforeEach(() => {
  measure.mockClear();
});

interface Options {
  label?: string;
  color?: string;
  canEdit?: boolean;
  selected?: boolean;
  height?: number;
}

function renderSticky({ label = '', color = 'orange', canEdit = true, selected = false, height = 250 }: Options = {}) {
  const onNodesChange = vi.fn<(changes: NodeChange<CanvasNode>[]) => void>();
  const onDelete = vi.fn();
  const node = {
    id: ID,
    type: 'canvasNode',
    position: { x: 0, y: 0 },
    width: 250,
    height,
    selected,
    data: { label, shape: 'sticky', color },
  } as CanvasNode;
  const ui = (n: CanvasNode) => (
    <TextMeasureContext.Provider value={measure}>
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow<CanvasNode>
            nodes={[n]}
            nodeTypes={nodeTypes}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onDelete={onDelete}
            nodesDraggable={canEdit}
            elementsSelectable={canEdit}
          />
        </div>
      </ReactFlowProvider>
    </TextMeasureContext.Provider>
  );
  const view = render(ui(node));
  const wrapper = view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${ID}"]`)!;
  const root = wrapper.querySelector<HTMLElement>('[data-kind="sticky"]')!;
  const commits = () =>
    onNodesChange.mock.calls
      .flatMap(([changes]) => changes)
      .filter((c): c is Extract<NodeChange<CanvasNode>, { type: 'replace' }> => c.type === 'replace');
  const rerenderWith = (patch: Partial<CanvasNode> & { data?: CanvasNode['data'] }) => view.rerender(ui({ ...node, ...patch }));
  return { ...view, wrapper, root, commits, onDelete, rerenderWith };
}

const textarea = () => screen.findByRole('textbox', { name: 'Node label' }) as Promise<HTMLTextAreaElement>;

describe('sticky node (F22)', () => {
  it('renders a new sticky in orange with radius, four handles and left/top text (AC-014)', () => {
    const { root } = renderSticky({ label: '' });
    expect(root).toHaveAttribute('aria-label', 'sticky note unlabelled');
    expect(root.style.backgroundColor).toMatch(/#331B00|rgb\(51, 27, 0\)/i);
    expect(root.style.color).toMatch(/#FF990A|rgb\(255, 153, 10\)/i);
    expect(root.style.borderRadius).toBe('4px');
    expect(root).toHaveClass('canvas-sticky-node'); // the shadow lives in globals.css
    expect(root.querySelectorAll('.react-flow__handle')).toHaveLength(4);
    const placeholder = root.querySelector('[data-slot="node-label-placeholder"]');
    expect(placeholder).toHaveTextContent('Double-click to label');
    expect(placeholder).toHaveStyle({ textAlign: 'left' });
  });

  it('renders a hex fill with derived black text', () => {
    const { root } = renderSticky({ label: 'x', color: '#FDE68A' });
    expect(root.style.backgroundColor).toMatch(/#FDE68A|rgb\(253, 230, 138\)/i);
    expect(root.style.color).toMatch(/#000000|rgb\(0, 0, 0\)/);
  });

  it('grows height to the content on commit, never shrinks, one replace each (AC-015)', async () => {
    const user = userEvent.setup();
    const { root, commits, rerenderWith } = renderSticky({ label: '' });
    fireEvent.doubleClick(root);
    await user.type(await textarea(), `${'a'.repeat(30)}{Enter}`);
    await waitFor(() => expect(commits()).toHaveLength(1));
    expect(commits()[0].item).toMatchObject({ height: 424, data: { label: 'a'.repeat(30) } });
    expect(measure).toHaveBeenCalledWith(expect.objectContaining({ width: 250, padding: { x: 12, y: 12 } }));

    // A short label fits: the write carries the label only and the (grown) height stays.
    rerenderWith({ height: 424, data: { label: 'a'.repeat(30), shape: 'sticky', color: 'orange' } });
    fireEvent.doubleClick(root);
    const input = await textarea();
    await user.clear(input);
    await user.type(input, 'short{Enter}');
    await waitFor(() => expect(commits()).toHaveLength(2));
    expect(commits()[1].item.height).toBe(424);
    expect(commits()[1].item.data.label).toBe('short');
  });

  it('keeps an empty committed sticky (never auto-deleted) and writes nothing when unchanged', async () => {
    const user = userEvent.setup();
    const { root, commits, onDelete } = renderSticky({ label: '' });
    fireEvent.doubleClick(root);
    await textarea();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(measure).toHaveBeenCalled());
    await act(async () => {});
    expect(commits()).toHaveLength(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('Enter on the focused sticky wrapper opens the editor (Review Focus 5)', async () => {
    const { wrapper } = renderSticky({ label: 'x' });
    wrapper.focus();
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(await textarea()).toBeInTheDocument();
  });

  it('viewers get no editor, resizer or placeholder', () => {
    const { root, container } = renderSticky({ label: '', canEdit: false, selected: true });
    fireEvent.doubleClick(root);
    expect(screen.queryByRole('textbox', { name: 'Node label' })).toBeNull();
    expect(container.querySelector('.react-flow__resize-control')).toBeNull();
    expect(root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('');
  });
});
