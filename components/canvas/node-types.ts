import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import { CanvasEdge } from './edges/canvas-edge';
import { CanvasNode } from './nodes/canvas-node';

/**
 * Module-level renderer registries (FR-007): React Flow re-mounts every node when these objects change identity.
 * The keys `canvasNode` / `canvasEdge` are part of canvas schema v1.
 */
export const nodeTypes = Object.freeze({ canvasNode: CanvasNode }) satisfies NodeTypes;
export const edgeTypes = Object.freeze({ canvasEdge: CanvasEdge }) satisfies EdgeTypes;
