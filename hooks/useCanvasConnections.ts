'use client';

import { type IsValidConnection, type OnConnect, type OnReconnect, type ReactFlowProps, useStoreApi } from '@xyflow/react';
import { useMemo, useRef } from 'react';

import type { CanvasMutations } from '@/hooks/useCanvasMutations';
import { buildEdge, isAllowedConnection, sameEndpoints } from '@/lib/canvas/connections';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

type Props = ReactFlowProps<CanvasNode, CanvasEdge>;
type OnReconnectStart = NonNullable<Props['onReconnectStart']>;
type OnReconnectEnd = NonNullable<Props['onReconnectEnd']>;

export interface CanvasConnections {
  isValidConnection: IsValidConnection<CanvasEdge>;
  onConnect: OnConnect;
  onReconnectStart: OnReconnectStart;
  onReconnect: OnReconnect<CanvasEdge>;
  onReconnectEnd: OnReconnectEnd;
}

/**
 * Edge creation and reconnection handlers for `<ReactFlow>` (F09 FR-003 – FR-005, D-09a, D-09b). Current edges are
 * read from the React Flow store at event time (never subscribed: NFR-004); every write goes through
 * `useCanvasMutations`, so viewers are refused there too. Must render under F06's `ReactFlowProvider`.
 */
export function useCanvasConnections(mutations: CanvasMutations): CanvasConnections {
  const store = useStoreApi<CanvasNode, CanvasEdge>();
  // The edge being reconnected is excluded from the duplicate scan, so dropping its end back on the same handle
  // is a valid no-op instead of an invalid drop that would delete it (EC-003).
  const reconnecting = useRef<string | null>(null);
  // Set by any `onReconnect` call, even a rejected one: the gesture ended on a handle, so it must not delete.
  const reconnectHandled = useRef(false);

  return useMemo(() => {
    const edges = () => store.getState().edges;
    const isValidConnection: IsValidConnection<CanvasEdge> = (c) =>
      isAllowedConnection(c, edges(), reconnecting.current ?? undefined);

    const onConnect: OnConnect = (c) => {
      if (!mutations.canEdit || !isAllowedConnection(c, edges())) return;
      mutations.addEdge(buildEdge(c));
    };

    const onReconnectStart: OnReconnectStart = (_event, edge) => {
      reconnecting.current = edge.id;
      reconnectHandled.current = false;
    };

    const onReconnect: OnReconnect<CanvasEdge> = (oldEdge, c) => {
      reconnectHandled.current = true;
      if (sameEndpoints(oldEdge, c) || !isAllowedConnection(c, edges(), oldEdge.id)) return;
      const { sourceHandle, targetHandle } = buildEdge(c, oldEdge.id);
      // The stored edge, not `oldEdge`: React Flow merges `defaultEdgeOptions` (the marker) into the one it hands
      // over, and the arrowhead must never be persisted (D-09c). Id and data are kept.
      const stored = store.getState().edgeLookup.get(oldEdge.id) ?? oldEdge;
      mutations.replaceEdge({ ...stored, source: c.source, target: c.target, sourceHandle, targetHandle });
    };

    const onReconnectEnd: OnReconnectEnd = (_event, edge, _handleType, state) => {
      const handled = reconnectHandled.current;
      reconnecting.current = null;
      reconnectHandled.current = false;
      // Released on empty space deletes the edge (D-09b); released on any handle (even an invalid one) keeps it.
      if (!handled && !state?.toHandle) mutations.onDelete({ nodes: [], edges: [edge] });
    };

    return { isValidConnection, onConnect, onReconnectStart, onReconnect, onReconnectEnd };
  }, [store, mutations]);
}
