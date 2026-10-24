'use client';

import { type OnNodesChange, Panel } from '@xyflow/react';

import { Button } from '@/components/ui/button';
import { newNodeId } from '@/lib/canvas/ids';
import type { CanvasNode } from '@/types/canvas';

interface DevAddNodeProps {
  nodeCount: number;
  onNodesChange: OnNodesChange<CanvasNode>;
}

/**
 * DEV/TEST ONLY (P-06-3, FR-014): adds one rectangle through the Liveblocks-backed `onNodesChange` so the
 * collaborative canvas is demonstrable before the F07 palette. Bottom-centre: the default-open project sidebar
 * covers the left edge. Mounted only when `devHooksEnabled`.
 * F07 MUST delete this component.
 */
export function DevAddNode({ nodeCount, onNodesChange }: DevAddNodeProps) {
  const add = () => {
    const n = nodeCount;
    const item: CanvasNode = {
      id: newNodeId('rectangle'),
      type: 'canvasNode',
      position: { x: 80 + 40 * n, y: 80 + 40 * n },
      width: 180,
      height: 80,
      data: { label: `Node ${n + 1}`, shape: 'rectangle', color: 'neutral' },
    };
    onNodesChange([{ type: 'add', item }]);
  };
  return (
    <Panel position="bottom-center">
      <Button size="sm" variant="outline" data-testid="dev-add-node" onClick={add}>
        Add test node
      </Button>
    </Panel>
  );
}
