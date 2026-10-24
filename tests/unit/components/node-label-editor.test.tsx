import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type NodeChange, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { nodeTypes } from '@/components/canvas/node-types';
import { type CanvasNode, LABEL_MAX_LENGTH } from '@/types/canvas';

// F08 label editor through the real node renderer inside a real React Flow store: the commit/cancel contract
// (AC-008 – AC-011), the viewer gate (AC-009) and the remote-delete guard (AC-014, unit half).

beforeAll(() => {
  // React Flow measures nodes and sets up d3-zoom; jsdom has neither DOMMatrix nor layout.
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
    constructor() {}
  } as unknown as typeof DOMMatrixReadOnly;
});

const ID = 'rectangle_01JBE0000000000000000000A1';
const node = (label: string): CanvasNode => ({
  id: ID,
  type: 'canvasNode',
  position: { x: 0, y: 0 },
  width: 180,
  height: 80,
  data: { label, shape: 'rectangle', color: 'neutral' },
});

function renderCanvas({ label = 'API', canEdit = true, nodes = [node(label)] } = {}) {
  const onNodesChange = vi.fn<(changes: NodeChange<CanvasNode>[]) => void>();
  const ui = (list: CanvasNode[]) => (
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow<CanvasNode>
          nodes={list}
          nodeTypes={nodeTypes}
          onNodesChange={canEdit ? onNodesChange : undefined}
          nodesDraggable={canEdit}
          elementsSelectable={canEdit}
        />
      </div>
    </ReactFlowProvider>
  );
  const view = render(ui(nodes));
  const wrapper = () => view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${ID}"]`)!;
  const body = () => wrapper().querySelector<HTMLElement>('[aria-label^="rectangle"]')!;
  const labelWrites = () =>
    onNodesChange.mock.calls.flatMap(([changes]) => changes).filter((c) => c.type === 'replace');
  return { ...view, onNodesChange, wrapper, body, labelWrites, rerenderWith: (list: CanvasNode[]) => view.rerender(ui(list)) };
}

const editor = () => screen.queryByRole('textbox', { name: 'Node label' }) as HTMLTextAreaElement | null;

describe('node label editor (F08)', () => {
  it('opens on double-click with the label selected and the drag/wheel/pan guards (AC-008)', () => {
    const { body } = renderCanvas();
    fireEvent.doubleClick(body());
    const textarea = editor()!;
    expect(textarea).toHaveFocus();
    expect(textarea.value).toBe('API');
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 3]);
    expect(textarea).toHaveClass('nodrag', 'nowheel', 'nopan');
    expect(textarea.maxLength).toBe(LABEL_MAX_LENGTH);
  });

  it('Enter commits the trimmed draft once and refocuses the node; Shift+Enter is a newline (AC-010)', async () => {
    const user = userEvent.setup();
    const { body, wrapper, labelWrites } = renderCanvas();
    fireEvent.doubleClick(body());
    await user.clear(editor()!);
    await user.type(editor()!, ' Gateway{Shift>}{Enter}{/Shift}v2 ');
    expect(editor()!.value).toBe(' Gateway\nv2 ');
    expect(labelWrites()).toHaveLength(0);

    await user.keyboard('{Enter}');
    expect(editor()).toBeNull();
    expect(wrapper()).toHaveFocus();
    expect(labelWrites()).toEqual([
      expect.objectContaining({ type: 'replace', id: ID, item: expect.objectContaining({ data: { label: 'Gateway\nv2', shape: 'rectangle', color: 'neutral' } }) }),
    ]);
  });

  it('writes nothing for an unchanged draft or on Escape; blur commits a changed draft (AC-010, AC-011)', async () => {
    const user = userEvent.setup();
    const { body, wrapper, labelWrites } = renderCanvas();

    fireEvent.doubleClick(body());
    await user.keyboard('{Enter}'); // unchanged draft
    expect(labelWrites()).toHaveLength(0);

    fireEvent.doubleClick(body());
    await user.type(editor()!, 'Queue');
    await user.keyboard('{Escape}');
    expect(editor()).toBeNull();
    expect(wrapper()).toHaveFocus();
    expect(labelWrites()).toHaveLength(0);
    expect(body()).toHaveTextContent('API');

    fireEvent.doubleClick(body());
    await user.type(editor()!, 'Cache');
    act(() => editor()!.blur());
    expect(editor()).toBeNull();
    expect(labelWrites()).toHaveLength(1);
    expect(labelWrites()[0]).toMatchObject({ item: { data: { label: 'APICache' } } }); // user.type clicks: caret at end
  });

  it('keeps editor keys away from React Flow and window listeners', async () => {
    const user = userEvent.setup();
    const { body, onNodesChange } = renderCanvas();
    const seen: string[] = [];
    const record = (e: KeyboardEvent) => seen.push(e.key);
    window.addEventListener('keydown', record);
    fireEvent.doubleClick(body());
    onNodesChange.mockClear();
    await user.keyboard('{Backspace}{Delete}{ArrowLeft}{ArrowUp}+-?{Control>}z{/Control}');
    window.removeEventListener('keydown', record);
    expect(seen).toEqual([]);
    // No nudge (position) or selection change reached React Flow's handler.
    expect(onNodesChange).not.toHaveBeenCalled();
    expect(editor()).not.toBeNull();
  });

  it('Enter on the focused node opens the editor; neither path opens it for a read-only member (AC-009)', () => {
    const editable = renderCanvas();
    fireEvent.keyDown(editable.wrapper(), { key: 'Enter' });
    expect(editor()).not.toBeNull();
    editable.unmount();

    const readOnly = renderCanvas({ canEdit: false });
    fireEvent.keyDown(readOnly.wrapper(), { key: 'Enter' });
    fireEvent.doubleClick(readOnly.body());
    expect(editor()).toBeNull();
    expect(readOnly.body().textContent).toBe('API');
  });

  it('closes without a write when the node is removed mid-edit (AC-014 unit half)', async () => {
    const user = userEvent.setup();
    const { body, rerenderWith, onNodesChange } = renderCanvas();
    fireEvent.doubleClick(body());
    await user.type(editor()!, 'typing');
    onNodesChange.mockClear();
    rerenderWith([]);
    expect(editor()).toBeNull();
    expect(onNodesChange.mock.calls.flatMap(([c]) => c).filter((c) => c.type === 'replace')).toEqual([]);
  });
});
