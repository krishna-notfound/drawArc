'use client';

import { useSelf, useStorage } from '@liveblocks/react/suspense';
import { useLiveblocksFlow } from '@liveblocks/react-flow';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  type NodeOrigin,
  ReactFlow,
  type ReactFlowInstance,
  type ReactFlowProps,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react';
import { type CSSProperties, type ReactNode, useCallback, useState } from 'react';

import type { ProjectRole } from '@/lib/access';
import { e2eHooksEnabled } from '@/lib/env.public';
import type { CanvasEdge, CanvasNode } from '@/types/canvas';

import { CanvasTestHooks } from './canvas-test-hooks';
import { edgeTypes, nodeTypes } from './node-types';
import { ShapePalette } from './shape-palette';
import { ViewerBadge } from './viewer-badge';

export interface FlowCanvasProps {
  role: ProjectRole;
  /** Rendered inside `<ReactFlow>` (F07 palette, F10 controls, F11 cursors) so they can use `useReactFlow`. */
  children?: ReactNode;
}

// Mount-time options of `useLiveblocksFlow` (EC-006): a constant, never derived from props. `storageKey: 'flow'` must
// match F17's server-side `mutateFlow`.
const FLOW_OPTIONS = {
  suspense: true,
  storageKey: 'flow',
  nodes: { initial: [] as CanvasNode[] },
  edges: { initial: [] as CanvasEdge[] },
} as const;

// Stable option objects for <ReactFlow> (FR-007, FR-008).
const PAN_ON_DRAG = [1, 2];
const NODE_ORIGIN: NodeOrigin = [0, 0];
const INITIAL_FIT = { padding: 0.2, maxZoom: 1 } as const;
// Flush surface (FR-011): React Flow's own background variable, since its unlayered CSS outranks Tailwind utilities.
const FLOW_STYLE = { '--xy-background-color': 'var(--bg-base)' } as CSSProperties;

/**
 * The collaborative canvas (FR-006): React Flow fed only by `useLiveblocksFlow` — nodes and edges live in
 * Liveblocks Storage, never in React state. Must render inside `ProjectRoom` (suspends until Storage loads).
 */
export function FlowCanvas({ role, children }: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasRoot role={role}>{children}</FlowCanvasRoot>
    </ReactFlowProvider>
  );
}

const EMPTY_NODES: CanvasNode[] = [];
const EMPTY_EDGES: CanvasEdge[] = [];

function FlowCanvasRoot({ role, children }: FlowCanvasProps) {
  // Both signals must agree (P-06-4): a stale `role` prop never grants write; the token is the authority.
  const tokenCanWrite = useSelf((me) => me.canWrite);
  const canWrite = role !== 'viewer' && tokenCanWrite;
  // `useLiveblocksFlow` creates the `flow` subtree on mount, which is a write: a read-only token in a room nobody
  // has edited yet would throw. Such members see an empty canvas until an editor creates the subtree.
  const flowExists = useStorage((root) => root.flow !== undefined);
  if (!tokenCanWrite && !flowExists) {
    return (
      <CanvasSurface nodes={EMPTY_NODES} edges={EMPTY_EDGES} canWrite={false}>
        {children}
      </CanvasSurface>
    );
  }
  return (
    <LiveCanvas canWrite={canWrite}>
      {children}
    </LiveCanvas>
  );
}

function LiveCanvas({ canWrite, children }: { canWrite: boolean; children?: ReactNode }) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } = useLiveblocksFlow<CanvasNode, CanvasEdge>(
    FLOW_OPTIONS,
  );
  // Read-only members get no change handlers: every Liveblocks mutation (even React Flow's local `measured`
  // updates) throws for a read-only token, and nodes render from their stored width/height anyway.
  return (
    <CanvasSurface
      nodes={nodes}
      edges={edges}
      canWrite={canWrite}
      handlers={canWrite ? { onNodesChange, onEdgesChange, onConnect, onDelete } : undefined}
    >
      {children}
    </CanvasSurface>
  );
}

interface CanvasSurfaceProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  canWrite: boolean;
  handlers?: Pick<
    ReactFlowProps<CanvasNode, CanvasEdge>,
    'onNodesChange' | 'onEdgesChange' | 'onConnect' | 'onDelete'
  >;
  children?: ReactNode;
}

function CanvasSurface({ nodes, edges, canWrite, handlers, children }: CanvasSurfaceProps) {
  // Fit once, only if the room already had nodes at mount (P-06-2, FR-009); an empty room keeps the default
  // viewport so the first added node never moves the view. No `fitView` prop: it would fire on the first drop.
  const [hadNodesAtMount] = useState(() => nodes.length > 0);
  const onInit = useCallback(
    (instance: ReactFlowInstance<CanvasNode, CanvasEdge>) => {
      if (hadNodesAtMount) void instance.fitView(INITIAL_FIT);
    },
    [hadNodesAtMount],
  );

  return (
    <div data-slot="flow-canvas" data-can-write={String(canWrite)} className="fixed inset-0 bg-base">
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={handlers?.onNodesChange}
        onEdgesChange={handlers?.onEdgesChange}
        onConnect={handlers?.onConnect}
        onDelete={handlers?.onDelete}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnScroll
        panOnDrag={PAN_ON_DRAG}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={4}
        nodeOrigin={NODE_ORIGIN}
        nodesDraggable={canWrite}
        nodesConnectable={canWrite}
        elementsSelectable={canWrite}
        edgesReconnectable={canWrite}
        style={FLOW_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} color="var(--border-default)" />
        <MiniMap
          position="bottom-right"
          pannable={false}
          zoomable={false}
          className="hidden md:block"
          bgColor="var(--bg-surface)"
          maskColor="rgb(8 8 9 / 0.6)"
          nodeColor="var(--border-subtle)"
        />
        {e2eHooksEnabled ? <CanvasTestHooks /> : null}
        {children}
      </ReactFlow>
      {canWrite ? <ShapePalette /> : <ViewerBadge />}
    </div>
  );
}
