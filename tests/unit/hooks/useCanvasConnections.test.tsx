import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { type Connection, type FinalConnectionState, ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useCanvasConnections } from '@/hooks/useCanvasConnections';
import type { CanvasMutations } from '@/hooks/useCanvasMutations';
import type { CanvasEdge } from '@/types/canvas';

const edge = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string) =>
  ({ id, source, sourceHandle, target, targetHandle, type: 'canvasEdge', data: { label: 'HTTPS' } }) as CanvasEdge;
const E = edge('e_E', 'x', 'right', 'y', 'left');
const F = edge('e_F', 'x', 'right', 'z', 'top');
const to = (target: string, targetHandle: string): Connection => ({ source: 'x', sourceHandle: 'right', target, targetHandle });

const mouse = new MouseEvent('mouseup');
// onReconnectStart receives React's synthetic event; the handler ignores it.
const press = {} as React.MouseEvent;
const onHandle = { toHandle: { id: 'left' } } as unknown as FinalConnectionState;
const onPane = { toHandle: null } as unknown as FinalConnectionState;

function setup(canEdit = true) {
  const mutations = {
    canEdit,
    addEdge: vi.fn(),
    replaceEdge: vi.fn(),
    onDelete: vi.fn(),
  } as unknown as CanvasMutations & Record<'addEdge' | 'replaceEdge' | 'onDelete', ReturnType<typeof vi.fn>>;
  const { result } = renderHook(() => ({ c: useCanvasConnections(mutations), store: useStoreApi() }), {
    wrapper: ReactFlowProvider,
  });
  act(() => {
    // The stored edge carries no marker; React Flow hands handlers a copy merged with defaultEdgeOptions.
    result.current.store.setState({ edges: [E, F], edgeLookup: new Map([[E.id, E], [F.id, F]]) });
  });
  const rendered = { ...E, markerEnd: { type: 'arrowclosed' } } as CanvasEdge;
  return { c: result.current.c, mutations, rendered };
}

describe('useCanvasConnections reconnection (F09 AC-010, AC-011, D-09b)', () => {
  it('dropping the end back on the same handle is valid during the gesture and writes nothing (AC-010)', () => {
    const { c, mutations, rendered } = setup();
    c.onReconnectStart(press, rendered, 'target');
    expect(c.isValidConnection(to('y', 'left'))).toBe(true);
    c.onReconnect(rendered, to('y', 'left'));
    c.onReconnectEnd(mouse, rendered, 'target', onHandle);
    expect(mutations.replaceEdge).not.toHaveBeenCalled();
    expect(mutations.onDelete).not.toHaveBeenCalled();
    // Outside a gesture the same connection is a duplicate of E again.
    expect(c.isValidConnection(to('y', 'left'))).toBe(false);
  });

  it('releasing on empty space deletes the edge once (drop-off delete)', () => {
    const { c, mutations, rendered } = setup();
    c.onReconnectStart(press, rendered, 'target');
    c.onReconnectEnd(mouse, rendered, 'target', onPane);
    expect(mutations.onDelete).toHaveBeenCalledExactlyOnceWith({ nodes: [], edges: [rendered] });
    expect(mutations.replaceEdge).not.toHaveBeenCalled();
  });

  it('a new valid handle replaces the stored edge in place (same id and data, no marker persisted)', () => {
    const { c, mutations, rendered } = setup();
    c.onReconnectStart(press, rendered, 'target');
    c.onReconnect(rendered, to('z', 'bottom'));
    c.onReconnectEnd(mouse, rendered, 'target', onHandle);
    expect(mutations.replaceEdge).toHaveBeenCalledExactlyOnceWith({ ...E, target: 'z', targetHandle: 'bottom' });
    expect(mutations.onDelete).not.toHaveBeenCalled();
  });

  it('a reconnect that would duplicate another edge, or a release on an invalid handle, changes nothing', () => {
    const { c, mutations, rendered } = setup();
    c.onReconnectStart(press, rendered, 'target');
    expect(c.isValidConnection(to('z', 'top'))).toBe(false);
    c.onReconnect(rendered, to('z', 'top'));
    c.onReconnectEnd(mouse, rendered, 'target', onHandle);
    // React Flow skips onReconnect for an invalid target; the release still ended on a handle.
    c.onReconnectStart(press, rendered, 'target');
    c.onReconnectEnd(mouse, rendered, 'target', onHandle);
    expect(mutations.replaceEdge).not.toHaveBeenCalled();
    expect(mutations.onDelete).not.toHaveBeenCalled();
  });
});

describe('useCanvasConnections onConnect (F09 FR-003, FR-011)', () => {
  it('adds one schema-v1 edge for editors and nothing for viewers', () => {
    const editor = setup(true);
    editor.c.onConnect(to('z', 'left'));
    expect(editor.mutations.addEdge).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: 'x', sourceHandle: 'right', target: 'z', targetHandle: 'left', data: {} }),
    );
    const viewer = setup(false);
    viewer.c.onConnect(to('z', 'left'));
    expect(viewer.mutations.addEdge).not.toHaveBeenCalled();
  });
});
