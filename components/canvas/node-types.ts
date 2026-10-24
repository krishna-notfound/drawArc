import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import { PlaceholderEdge } from './edges/placeholder-edge';
import { CanvasNode } from './nodes/canvas-node';

/**
 * Module-level renderer registries (FR-007): React Flow re-mounts every node when these objects change identity.
 * F09 swaps the edge renderer; the keys `canvasNode` / `canvasEdge` are part of canvas schema v1.
 */
export const nodeTypes = Object.freeze({ canvasNode: CanvasNode }) satisfies NodeTypes;
export const edgeTypes = { canvasEdge: PlaceholderEdge } satisfies EdgeTypes;
