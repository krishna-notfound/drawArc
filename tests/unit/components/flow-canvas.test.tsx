import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasEdge } from '@/components/canvas/edges/canvas-edge';
import { FlowCanvas } from '@/components/canvas/flow-canvas';
import { edgeTypes } from '@/components/canvas/node-types';
import type { ProjectRole } from '@/lib/access';

// Captures what FlowCanvas hands to <ReactFlow> and to useLiveblocksFlow; React Flow itself is not rendered (its
// provider is real: the F07/F09 hooks read the store).
const captured = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
  hookArgs: [] as unknown[],
  canWrite: true,
  flowExists: true,
  flow: {
    nodes: [] as unknown[],
    edges: [] as unknown[],
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    onDelete: vi.fn(),
  },
}));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ReactFlow: ({ children, ...props }: { children: ReactNode }) => {
      captured.props.push(props);
      return <div data-testid="react-flow">{children}</div>;
    },
    Background: () => null,
    MiniMap: () => null,
    Panel: ({ children }: { children: ReactNode }) => children,
  };
});

// The palette needs a real React Flow store; here only its presence is asserted.
vi.mock('@/components/canvas/shape-palette', () => ({
  ShapePalette: () => <div role="toolbar" aria-label="Shape palette" />,
}));

vi.mock('@liveblocks/react-flow', () => ({
  useLiveblocksFlow: (options: unknown) => {
    captured.hookArgs.push(options);
    return captured.flow;
  },
}));

vi.mock('@liveblocks/react/suspense', () => ({
  useSelf: (select: (me: { canWrite: boolean }) => unknown) => select({ canWrite: captured.canWrite }),
  useStorage: (select: (root: { flow?: object }) => unknown) => select(captured.flowExists ? { flow: {} } : {}),
  useStatus: () => 'connected',
  useSyncStatus: () => 'synchronized',
}));

const NODE = { id: 'rectangle_01JBE0000000000000000000A1', type: 'canvasNode', position: { x: 0, y: 0 }, data: {} };

function renderCanvas(role: ProjectRole, canWrite: boolean) {
  captured.canWrite = canWrite;
  render(
    <FlowCanvas role={role}>
      <span data-testid="child" />
    </FlowCanvas>,
  );
  return captured.props.at(-1)!;
}

beforeEach(() => {
  captured.props.length = 0;
  captured.hookArgs.length = 0;
  captured.flow.nodes = [];
  captured.flowExists = true;
});

const WRITE_PROPS = ['nodesDraggable', 'nodesConnectable', 'elementsSelectable', 'edgesReconnectable'] as const;

describe('FlowCanvas read-only mode (AC-015, P-06-4)', () => {
  it.each<[ProjectRole, boolean, boolean]>([
    ['viewer', false, false],
    // A stale editor prop never grants write when the token is read-only…
    ['editor', false, false],
    // …and a writable token never grants write to a viewer.
    ['viewer', true, false],
    ['editor', true, true],
  ])('role %s with token canWrite=%s → writable=%s', (role, canWrite, writable) => {
    const props = renderCanvas(role, canWrite);
    for (const key of WRITE_PROPS) expect(props[key]).toBe(writable);
    // Panning and zooming stay on for everyone.
    expect(props.panOnScroll).toBe(true);
    expect(screen.queryByText('View only') !== null).toBe(!writable);
    // F07 FR-012: the shape palette exists only for writable members.
    expect(screen.queryByRole('toolbar', { name: 'Shape palette' }) !== null).toBe(writable);
    // Read-only members get no change handlers: Liveblocks throws on any mutation from a read-only token.
    expect(props.onNodesChange === captured.flow.onNodesChange).toBe(writable);
  });

  it('a read-only token in a room without a flow subtree never mounts useLiveblocksFlow (it would write)', () => {
    captured.flowExists = false;
    const props = renderCanvas('viewer', false);
    expect(captured.hookArgs).toHaveLength(0);
    expect(props.nodes).toEqual([]);
    expect(props.nodesDraggable).toBe(false);
  });
});

describe('FlowCanvas wiring (AC-009, AC-010, AC-011)', () => {
  it('feeds React Flow only from useLiveblocksFlow with the frozen options and interaction defaults', () => {
    captured.flow.nodes = [NODE];
    const props = renderCanvas('editor', true);

    expect(captured.hookArgs[0]).toEqual({ suspense: true, storageKey: 'flow', nodes: { initial: [] }, edges: { initial: [] } });
    expect(props.nodes).toBe(captured.flow.nodes);
    expect(props.edges).toBe(captured.flow.edges);
    for (const key of ['onNodesChange', 'onEdgesChange', 'onDelete'] as const) {
      expect(props[key]).toBe(captured.flow[key]);
    }
    // F09 D-09a: edges are built by F09's own onConnect, not the hook's.
    expect(props.onConnect).toBeTypeOf('function');
    expect(props.onConnect).not.toBe(captured.flow.onConnect);
    expect(props).toMatchObject({
      connectionMode: 'loose',
      selectionOnDrag: true,
      selectionMode: 'partial',
      panOnDrag: [1, 2],
      zoomOnScroll: false,
      zoomOnDoubleClick: false,
      deleteKeyCode: null,
      minZoom: 0.1,
      maxZoom: 4,
      nodeOrigin: [0, 0],
    });
    expect(props).not.toHaveProperty('fitView');
    expect(screen.getByTestId('react-flow')).toContainElement(screen.getByTestId('child'));
  });

  it('fits the view once on init only when the room had nodes at mount', () => {
    const empty = renderCanvas('editor', true);
    const emptyInstance = { fitView: vi.fn() };
    (empty.onInit as (i: unknown) => void)(emptyInstance);
    expect(emptyInstance.fitView).not.toHaveBeenCalled();

    cleanup();
    captured.flow.nodes = [NODE, NODE, NODE];
    const filled = renderCanvas('editor', true);
    const instance = { fitView: vi.fn() };
    (filled.onInit as (i: unknown) => void)(instance);
    expect(instance.fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, maxZoom: 1 });
  });
});

describe('FlowCanvas edges (F09 AC-001)', () => {
  it('registers the memoised canvasEdge and a stable defaultEdgeOptions with the closed arrowhead', () => {
    const first = renderCanvas('editor', true);
    expect(Object.isFrozen(edgeTypes)).toBe(true);
    expect(Object.keys(edgeTypes)).toEqual(['canvasEdge']);
    expect(edgeTypes.canvasEdge).toBe(CanvasEdge);
    expect((CanvasEdge as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
    expect(first.edgeTypes).toBe(edgeTypes);
    expect(first.defaultEdgeOptions).toEqual({
      type: 'canvasEdge',
      markerEnd: { type: 'arrowclosed', width: 16, height: 16, color: '#f8fafc' },
    });
    expect(typeof first.isValidConnection).toBe('function');
    cleanup();
    const second = renderCanvas('editor', true);
    expect(second.defaultEdgeOptions).toBe(first.defaultEdgeOptions);
    expect(second.edgeTypes).toBe(first.edgeTypes);
  });
});
