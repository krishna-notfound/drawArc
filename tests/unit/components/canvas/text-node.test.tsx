import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type NodeChange, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { nodeTypes } from '@/components/canvas/node-types';
import { TextMeasureContext } from '@/components/canvas/nodes/text-measure-context';
import { requestEditorOpen } from '@/lib/canvas/pending-editor';
import type { CanvasNode } from '@/types/canvas';

// F22 text node through the real renderer inside a real React Flow store: rest look (AC-009), the measured commit
// (AC-010), the delete paths (AC-013), Esc (AC-012 unit half), and the Review Focus 1 / 2 write guards.

beforeAll(() => {
  // React Flow measures nodes and sets up d3-zoom; jsdom has neither DOMMatrixReadOnly nor layout.
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
    constructor() {}
  } as unknown as typeof DOMMatrixReadOnly;
});

const ID = 'text_01JBE0000000000000000000T1';
const measure = vi.fn(async ({ text }: { text: string }) =>
  text.trim() === '' ? { width: 24, height: 20 } : { width: 120, height: 24 },
);

beforeEach(() => {
  measure.mockClear();
});

interface Options {
  label?: string;
  color?: string;
  canEdit?: boolean;
  selected?: boolean;
  autoWidth?: boolean;
  width?: number;
  height?: number;
}

function renderText({ label = '', color = 'neutral', canEdit = true, selected = false, autoWidth = true, width = 24, height = 20 }: Options = {}) {
  const onNodesChange = vi.fn<(changes: NodeChange<CanvasNode>[]) => void>();
  const onDelete = vi.fn();
  const nodes = [
    {
      id: ID,
      type: 'canvasNode',
      position: { x: 0, y: 0 },
      width,
      height,
      selected,
      data: { label, shape: 'text', color, autoWidth },
    } as CanvasNode,
  ];
  const view = render(
    <TextMeasureContext.Provider value={measure}>
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <ReactFlow<CanvasNode>
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onDelete={onDelete}
            nodesDraggable={canEdit}
            elementsSelectable={canEdit}
          />
        </div>
      </ReactFlowProvider>
    </TextMeasureContext.Provider>,
  );
  const wrapper = view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${ID}"]`)!;
  const root = wrapper.querySelector<HTMLElement>('[data-kind="text"]')!;
  const commits = () =>
    onNodesChange.mock.calls
      .flatMap(([changes]) => changes)
      .filter((c): c is Extract<NodeChange<CanvasNode>, { type: 'replace' }> => c.type === 'replace');
  return { ...view, wrapper, root, commits, onDelete };
}

const textarea = () => screen.findByRole('textbox', { name: 'Node label' }) as Promise<HTMLTextAreaElement>;

describe('text node (F22)', () => {
  it('renders at rest with no fill, border or handles, pre whitespace and the palette text colour (AC-009)', () => {
    const { root } = renderText({ label: 'Hello', color: 'blue' });
    expect(root).toHaveAttribute('aria-label', 'text Hello');
    expect(root.style.background).toBe('');
    expect(root.style.border).toBe('');
    expect(root.querySelectorAll('.react-flow__handle')).toHaveLength(0);
    expect(root).toHaveStyle({ color: '#52A8FF' });
    expect(root.querySelector('[data-slot="node-label"]')).toHaveStyle({ whiteSpace: 'pre' });
  });

  it('renders a hex colour as the text colour itself and the "Text" placeholder for editors only', () => {
    const empty = renderText({ label: '', color: '#FDE68A' });
    expect(empty.root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('Text');
    empty.unmount();
    const hex = renderText({ label: 'x', color: '#FDE68A' });
    expect(hex.root).toHaveStyle({ color: '#FDE68A' });
    hex.unmount();
    const viewer = renderText({ label: '', canEdit: false });
    expect(viewer.root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('');
  });

  it('opens on creation, measures after fonts are ready and commits label + size in one replace (AC-010)', async () => {
    const user = userEvent.setup();
    requestEditorOpen(ID);
    const { commits } = renderText({ label: '' });
    const input = await textarea();
    expect(input).toHaveFocus();
    expect(input.maxLength).toBe(500);
    await user.type(input, 'Hello world{Enter}');
    await waitFor(() => expect(commits()).toHaveLength(1));
    expect(commits()[0].item).toMatchObject({ width: 120, height: 24, data: { label: 'Hello world', autoWidth: true } });
    expect(measure).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Hello world', padding: { x: 6, y: 4 }, width: undefined }));
  });

  it('caps a 1000-character paste at 500 and still writes once (EC-010)', async () => {
    const user = userEvent.setup();
    requestEditorOpen(ID);
    const { commits } = renderText({ label: '' });
    const input = await textarea();
    await user.click(input);
    await user.paste('x'.repeat(1000));
    expect(input.value).toHaveLength(500);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(commits()).toHaveLength(1));
    expect(commits()[0].item.data.label).toHaveLength(500);
  });

  it('deletes a never-labelled node on blur or Escape, and a labelled node committed empty (AC-013)', async () => {
    const user = userEvent.setup();

    requestEditorOpen(ID);
    const blurred = renderText({ label: '' });
    fireEvent.blur(await textarea());
    await waitFor(() => expect(blurred.onDelete).toHaveBeenCalledTimes(1));
    expect(blurred.onDelete).toHaveBeenCalledWith({ nodes: [expect.objectContaining({ id: ID })], edges: [] });
    expect(blurred.commits()).toHaveLength(0);
    blurred.unmount();

    requestEditorOpen(ID);
    const escaped = renderText({ label: '' });
    await textarea();
    await user.keyboard('{Escape}');
    expect(escaped.onDelete).toHaveBeenCalledTimes(1);
    expect(escaped.commits()).toHaveLength(0);
    escaped.unmount();

    const cleared = renderText({ label: 'x', width: 120, height: 24 });
    fireEvent.doubleClick(cleared.root);
    const input = await textarea();
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(cleared.onDelete).toHaveBeenCalledTimes(1);
    expect(cleared.commits()).toHaveLength(0);
  });

  it('deletes the node when the committed label is whitespace only (Review Focus 2)', async () => {
    const user = userEvent.setup();
    requestEditorOpen(ID);
    const { commits, onDelete } = renderText({ label: '' });
    const input = await textarea();
    await user.type(input, '  {Shift>}{Enter}{/Shift} {Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(commits()).toHaveLength(0);
  });

  it('writes nothing when label and measured size are unchanged (Review Focus 1)', async () => {
    const user = userEvent.setup();
    const { root, commits, onDelete } = renderText({ label: 'Hello world', width: 120, height: 24 });
    fireEvent.doubleClick(root);
    await textarea();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(measure).toHaveBeenCalled());
    await act(async () => {});
    expect(commits()).toHaveLength(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('Escape keeps an existing label without a write and no delete (AC-012 unit half)', async () => {
    const user = userEvent.setup();
    const { root, commits, onDelete } = renderText({ label: 'Keep', width: 120, height: 24 });
    fireEvent.doubleClick(root);
    const input = await textarea();
    await user.clear(input);
    await user.type(input, 'Changed{Escape}');
    expect(commits()).toHaveLength(0);
    expect(onDelete).not.toHaveBeenCalled();
    expect(root.querySelector('[data-slot="node-label"]')).toHaveTextContent('Keep');
  });

  it('wraps and re-measures only height when autoWidth is false', async () => {
    const user = userEvent.setup();
    measure.mockImplementationOnce(async () => ({ width: 100, height: 48 }));
    const { root, commits } = renderText({ label: 'a long label', autoWidth: false, width: 100, height: 24 });
    expect(root.querySelector('[data-slot="node-label"]')).toHaveStyle({ whiteSpace: 'pre-wrap' });
    fireEvent.doubleClick(root);
    await textarea();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(commits()).toHaveLength(1));
    expect(commits()[0].item).toMatchObject({ width: 100, height: 48, data: { autoWidth: false } });
    expect(measure).toHaveBeenCalledWith(expect.objectContaining({ width: 100 }));
  });

  it('shows only the left/right line controls when selected by an editor', () => {
    const editor = renderText({ label: 'x', selected: true, width: 120, height: 24 });
    expect(editor.container.querySelector('.react-flow__resize-control.line.left')).not.toBeNull();
    expect(editor.container.querySelector('.react-flow__resize-control.line.right')).not.toBeNull();
    expect(editor.container.querySelector('.react-flow__resize-control.handle')).toBeNull();
    editor.unmount();
    const viewer = renderText({ label: 'x', selected: true, canEdit: false });
    expect(viewer.container.querySelector('.react-flow__resize-control')).toBeNull();
  });
});
