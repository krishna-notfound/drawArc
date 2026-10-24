// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDocument } from '@/lib/canvas/schema';
import { fromDocument, toDocument } from '@/lib/canvas/serialize';
import { type CanvasDocument, type CanvasEdge, type CanvasNode, DEFAULT_SIZES } from '@/types/canvas';
import { makeCanvasDocument, testUlid } from '@/tests/factories';

const v1Small = JSON.parse(readFileSync('tests/fixtures/canvas/v1-small.json', 'utf8')) as CanvasDocument;
const RUNTIME_KEYS = ['selected', 'dragging', 'measured', 'resizing', 'style', 'className', 'zIndex'];

const nodeA = `rectangle_${testUlid(1)}`;
const nodeB = `circle_${testUlid(2)}`;
const nodeC = `hexagon_${testUlid(3)}`;

describe('toDocument (AC-007)', () => {
  it('strips runtime fields and fills sizes and handles', () => {
    const nodes: CanvasNode[] = [
      {
        id: nodeA,
        type: 'canvasNode',
        position: { x: 10, y: 20 },
        width: 200,
        height: 90,
        data: { label: 'A', shape: 'rectangle', color: 'blue' },
        selected: true,
        dragging: true,
        resizing: true,
        measured: { width: 1, height: 1 },
        style: { opacity: 0.5 },
        className: 'x',
        zIndex: 3,
      },
      // No width/height: the measured size wins.
      { id: nodeB, type: 'canvasNode', position: { x: 0, y: 0 }, measured: { width: 100, height: 101 }, data: { label: 'B', shape: 'circle', color: 'teal' } },
      // Neither: the shape's default size.
      { id: nodeC, type: 'canvasNode', position: { x: 5, y: 5 }, data: { label: '', shape: 'hexagon', color: 'neutral' } },
    ];
    const edges: CanvasEdge[] = [{ id: `e_${testUlid(1)}`, type: 'canvasEdge', source: nodeA, target: nodeB, selected: true }];

    const doc = toDocument(nodes, edges);

    expect(validateDocument(doc).ok).toBe(true);
    for (const item of [...doc.nodes, ...doc.edges]) {
      for (const key of RUNTIME_KEYS) expect(item).not.toHaveProperty(key);
    }
    expect(doc.nodes.map((n) => [n.width, n.height])).toEqual([
      [200, 90],
      [100, 101],
      [DEFAULT_SIZES.hexagon.width, DEFAULT_SIZES.hexagon.height],
    ]);
    expect(doc.edges[0]).toEqual({ id: `e_${testUlid(1)}`, type: 'canvasEdge', source: nodeA, target: nodeB, sourceHandle: 'right', targetHandle: 'left' });
  });
});

describe('round trip (AC-008)', () => {
  it.each([
    ['empty', makeCanvasDocument({ nodes: 0 })],
    ['small-5-nodes', makeCanvasDocument({ nodes: 5 })],
    ['large-500-nodes', makeCanvasDocument({ nodes: 500 })],
    ['v1-small', v1Small],
  ])('toDocument(fromDocument(%s)) deep-equals the input', (_name, doc) => {
    const { nodes, edges } = fromDocument(doc);
    expect(toDocument(nodes, edges)).toEqual(doc);
  });
});
