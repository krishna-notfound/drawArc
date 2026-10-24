import type { ReactNode } from 'react';

import { boundsOf } from '@/lib/canvas/layout-check';
import type { CanvasTemplate } from '@/lib/canvas/templates';
import { NODE_COLORS, type PersistedNode } from '@/types/canvas';

const PADDING = 24;

/** Same outlines as F07's ShapeRenderer, mapped onto the node's rectangle. */
function NodeShape({ node }: { node: PersistedNode }) {
  const { x, y } = node.position;
  const { width: w, height: h } = node;
  const colors = NODE_COLORS[node.data.color];
  // The preview is scaled down ~6×; a non-scaling stroke keeps outlines at 1 px on screen.
  const paint = { fill: colors.fill, stroke: colors.text, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' } as const;
  const points = (pairs: [number, number][]) => pairs.map(([px, py]) => `${x + px * w},${y + py * h}`).join(' ');
  let shape: ReactNode;
  switch (node.data.shape) {
    case 'rectangle':
      shape = <rect x={x} y={y} width={w} height={h} rx={8} {...paint} />;
      break;
    case 'pill':
      shape = <rect x={x} y={y} width={w} height={h} rx={h / 2} {...paint} />;
      break;
    case 'circle':
      shape = <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2} {...paint} />;
      break;
    case 'diamond':
      shape = <polygon points={points([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]])} {...paint} />;
      break;
    case 'hexagon':
      shape = <polygon points={points([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]])} {...paint} />;
      break;
    case 'cylinder':
      shape = (
        <>
          <rect x={x} y={y} width={w} height={h} rx={6} {...paint} />
          <ellipse cx={x + w / 2} cy={y + h * 0.1} rx={w / 2} ry={h * 0.1} {...paint} />
        </>
      );
      break;
  }
  return <g data-node-id={node.id}>{shape}</g>;
}

/**
 * Static thumbnail of a template (F14 FR-006): pure SVG computed from node bounds, no React Flow instance and
 * no labels. Edges are straight centre-to-centre lines under the nodes.
 */
export function TemplatePreview({ template, className }: { template: CanvasTemplate; className?: string }) {
  const { nodes, edges } = template.document;
  const bounds = boundsOf(nodes) ?? { x: 0, y: 0, width: 0, height: 0 };
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const centre = (node: PersistedNode) => ({ x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 });
  return (
    <svg
      role="img"
      aria-label={`Preview of ${template.name}`}
      viewBox={`${bounds.x - PADDING} ${bounds.y - PADDING} ${bounds.width + 2 * PADDING} ${bounds.height + 2 * PADDING}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      {edges.map((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return null;
        const a = centre(source);
        const b = centre(target);
        return (
          <line
            key={edge.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--text-faint)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {nodes.map((node) => (
        <NodeShape key={node.id} node={node} />
      ))}
    </svg>
  );
}
