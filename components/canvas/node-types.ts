import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import { PlaceholderEdge } from './edges/placeholder-edge';
import { PlaceholderNode } from './nodes/placeholder-node';

/**
 * Module-level renderer registries (FR-007): React Flow re-mounts every node when these objects change identity.
 * F08/F09 swap the renderers; the keys `canvasNode` / `canvasEdge` are part of canvas schema v1.
 */
export const nodeTypes = { canvasNode: PlaceholderNode } satisfies NodeTypes;
export const edgeTypes = { canvasEdge: PlaceholderEdge } satisfies EdgeTypes;
