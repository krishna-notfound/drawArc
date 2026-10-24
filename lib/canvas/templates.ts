import { newEdgeId, newNodeId } from '@/lib/canvas/ids';
import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type CanvasEdge,
  type CanvasNode,
  DEFAULT_SIZES,
  type HandleId,
  type NodeColorId,
  type NodeShape,
  type PersistedEdge,
  type PersistedNode,
} from '@/types/canvas';

/**
 * Starter templates (F14). Source-controlled, schema-v1 documents validated by `CanvasDocumentSchema` in tests.
 * Colours follow one legend: blue = services, teal = data stores, purple = messaging, orange = decisions/caches,
 * green = deploy targets, red = failure paths, neutral = actors. Ids are regenerated on every import.
 */
export type CanvasTemplateId = 'microservices' | 'cicd-pipeline' | 'event-driven';

export interface CanvasTemplate {
  id: CanvasTemplateId;
  name: string;
  description: string;
  document: CanvasDocument;
}

// Grid layout: each node is centred in a CELL_W × CELL_H cell; cells are COL / ROW apart, which leaves at
// least 60 px between any two nodes (FR-002 asks for 40) because no default size exceeds the cell.
const COL = 280;
const ROW = 200;
const CELL_W = 180;
const CELL_H = 140;

type NodeSpec<K extends string> = [key: K, shape: NodeShape, label: string, color: NodeColorId, col: number, row: number];
type EdgeSpec<K extends string> = [source: K, sourceHandle: HandleId, target: K, targetHandle: HandleId, label?: string];

/**
 * Builds a template document from readable keys. Source ids are deterministic and schema-valid
 * (`${shape}_` + 26 Crockford base32 chars) so the fixtures are stable; `instantiateTemplate` replaces them.
 */
function buildDocument<K extends string>(code: string, nodes: NodeSpec<K>[], edges: EdgeSpec<K>[]): CanvasDocument {
  const ids = new Map<K, string>();
  const persistedNodes = nodes.map(([key, shape, label, color, col, row], i): PersistedNode => {
    const { width, height } = DEFAULT_SIZES[shape];
    const id = `${shape}_${`${code}${String(i + 1).padStart(2, '0')}`.padStart(26, '0')}`;
    ids.set(key, id);
    return {
      id,
      type: 'canvasNode',
      position: { x: col * COL + (CELL_W - width) / 2, y: row * ROW + (CELL_H - height) / 2 },
      width,
      height,
      data: { label, shape, color },
    };
  });
  const persistedEdges = edges.map(([source, sourceHandle, target, targetHandle, label], i): PersistedEdge => ({
    id: `e_${`E${code}${String(i + 1).padStart(2, '0')}`.padStart(26, '0')}`,
    type: 'canvasEdge',
    source: ids.get(source)!,
    target: ids.get(target)!,
    sourceHandle,
    targetHandle,
    data: label ? { label } : {},
  }));
  return { schemaVersion: CANVAS_SCHEMA_VERSION, nodes: persistedNodes, edges: persistedEdges };
}

const microservices = buildDocument(
  'MS',
  [
    ['client', 'pill', 'Client', 'neutral', 0, 1],
    ['gateway', 'hexagon', 'API Gateway', 'blue', 1, 1],
    ['auth', 'rectangle', 'Auth Service', 'blue', 2, 0],
    ['orders', 'rectangle', 'Orders Service', 'blue', 2, 1],
    ['payments', 'rectangle', 'Payments Service', 'blue', 2, 2],
    ['usersDb', 'cylinder', 'Users DB', 'teal', 3, 0],
    ['ordersDb', 'cylinder', 'Orders DB', 'teal', 3, 1],
    ['paymentsDb', 'cylinder', 'Payments DB', 'teal', 3, 2],
    ['cache', 'circle', 'Cache', 'orange', 1, 2],
  ],
  [
    ['client', 'right', 'gateway', 'left', 'HTTPS'],
    ['gateway', 'right', 'auth', 'left'],
    ['gateway', 'right', 'orders', 'left'],
    ['gateway', 'right', 'payments', 'left'],
    ['auth', 'right', 'usersDb', 'left'],
    ['orders', 'right', 'ordersDb', 'left'],
    ['payments', 'right', 'paymentsDb', 'left'],
    ['gateway', 'bottom', 'cache', 'top', 'session'],
  ],
);

// The pipeline runs along the top row, then down the right column; failures drop into Notify, which loops
// back to the developer under the top row so no arrow crosses a node.
const cicdPipeline = buildDocument(
  'CD',
  [
    ['dev', 'pill', 'Developer', 'neutral', 0, 0],
    ['push', 'rectangle', 'Git Push', 'neutral', 1, 0],
    ['build', 'rectangle', 'Build', 'blue', 2, 0],
    ['tests', 'diamond', 'Tests pass?', 'orange', 3, 0],
    ['registry', 'cylinder', 'Container Registry', 'teal', 4, 0],
    ['staging', 'rectangle', 'Deploy Staging', 'green', 4, 1],
    ['smoke', 'diamond', 'Smoke test OK?', 'orange', 4, 2],
    ['production', 'rectangle', 'Deploy Production', 'green', 4, 3],
    ['notify', 'circle', 'Notify', 'red', 3, 1],
  ],
  [
    ['dev', 'right', 'push', 'left'],
    ['push', 'right', 'build', 'left'],
    ['build', 'right', 'tests', 'left'],
    ['tests', 'right', 'registry', 'left', 'yes'],
    ['tests', 'bottom', 'notify', 'top', 'no'],
    ['registry', 'bottom', 'staging', 'top'],
    ['staging', 'bottom', 'smoke', 'top'],
    ['smoke', 'bottom', 'production', 'top', 'yes'],
    ['smoke', 'left', 'notify', 'bottom', 'no'],
    ['notify', 'left', 'dev', 'bottom'],
  ],
);

const eventDriven = buildDocument(
  'EV',
  [
    ['order', 'rectangle', 'Order Service', 'blue', 0, 0],
    ['inventory', 'rectangle', 'Inventory Service', 'blue', 2, 3],
    ['bus', 'hexagon', 'Event Bus', 'purple', 1, 1],
    ['notification', 'rectangle', 'Notification Consumer', 'blue', 2, 0],
    ['analytics', 'rectangle', 'Analytics Consumer', 'blue', 2, 1],
    ['fulfilment', 'rectangle', 'Fulfilment Consumer', 'blue', 2, 2],
    ['email', 'pill', 'Email Provider', 'neutral', 3, 0],
    ['analyticsStore', 'cylinder', 'Analytics Store', 'teal', 3, 1],
    ['warehouseDb', 'cylinder', 'Warehouse DB', 'teal', 3, 2],
    ['dlq', 'circle', 'Dead-letter Queue', 'red', 0, 2],
  ],
  [
    ['order', 'right', 'bus', 'top', 'order.created'],
    ['inventory', 'left', 'bus', 'bottom', 'stock.changed'],
    ['bus', 'right', 'notification', 'left'],
    ['bus', 'right', 'analytics', 'left'],
    ['bus', 'right', 'fulfilment', 'left'],
    ['notification', 'right', 'email', 'left'],
    ['analytics', 'right', 'analyticsStore', 'left'],
    ['fulfilment', 'right', 'warehouseDb', 'left'],
    ['bus', 'bottom', 'dlq', 'right', 'failed'],
    ['dlq', 'top', 'bus', 'left', 'retry'],
    ['fulfilment', 'bottom', 'inventory', 'top', 'reserve'],
  ],
);

export const CANVAS_TEMPLATES: readonly CanvasTemplate[] = [
  {
    id: 'microservices',
    name: 'Microservices',
    description: 'API gateway in front of three services with their own databases and a shared cache.',
    document: microservices,
  },
  {
    id: 'cicd-pipeline',
    name: 'CI/CD pipeline',
    description: 'Commit → build → test → registry → staging → smoke test → production, with failure paths.',
    document: cicdPipeline,
  },
  {
    id: 'event-driven',
    name: 'Event-driven system',
    description: 'Producers publish to an event bus; consumers process, persist and dead-letter failures.',
    document: eventDriven,
  },
];

export function findTemplate(id: string): CanvasTemplate | undefined {
  return CANVAS_TEMPLATES.find((template) => template.id === id);
}

/**
 * A fresh copy of the template ready to add to a room (FR-003, D-14b): new node and edge ids, edges remapped,
 * new `position`/`data` objects. Two calls never share an id, so a template can be imported repeatedly.
 */
export function instantiateTemplate(template: CanvasTemplate): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const idMap = new Map<string, string>();
  const nodes = template.document.nodes.map((node): CanvasNode => {
    const id = newNodeId(node.data.shape);
    idMap.set(node.id, id);
    return {
      id,
      type: 'canvasNode',
      position: { ...node.position },
      width: node.width,
      height: node.height,
      data: { ...node.data },
    };
  });
  const edges = template.document.edges.map(
    (edge): CanvasEdge => ({
      id: newEdgeId(),
      type: 'canvasEdge',
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { ...edge.data },
    }),
  );
  return { nodes, edges };
}
