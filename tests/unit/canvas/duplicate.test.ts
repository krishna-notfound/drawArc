import { describe, expect, it } from 'vitest';

import { duplicateSelection } from '@/lib/canvas/duplicate';
import type { CanvasEdge, CanvasNode, NodeShape } from '@/types/canvas';

const node = (id: string, x: number, shape: NodeShape = 'rectangle'): CanvasNode => ({
  id,
  type: 'canvasNode',
  position: { x, y: 10 },
  width: 160,
  height: 80,
  data: { label: id, shape, color: 'blue' },
  selected: true,
  dragging: false,
  measured: { width: 160, height: 80 },
});
const edge = (id: string, source: string, target: string): CanvasEdge => ({
  id,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  type: 'canvasEdge',
  data: { label: 'calls' },
  selected: true,
});

describe('duplicateSelection (F10 AC-013, D-10d)', () => {
  it('copies the selected nodes and only the edges between them, with new ids and a +20 px offset', () => {
    const x = node('rectangle_X', 0);
    const y = node('diamond_Y', 300, 'diamond');
    const e = edge('e_E', x.id, y.id);
    const f = edge('e_F', x.id, 'circle_Z'); // Z is not selected

    const out = duplicateSelection([x, y], [e, f]);

    expect(out.nodes).toHaveLength(2);
    const [x2, y2] = out.nodes;
    expect(x2.id).toMatch(/^rectangle_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(y2.id).toMatch(/^diamond_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(x2.position).toEqual({ x: 20, y: 30 });
    expect(y2.position).toEqual({ x: 320, y: 30 });
    expect(x2).toMatchObject({ type: 'canvasNode', width: 160, height: 80, data: x.data });
    expect(x2.data).not.toBe(x.data);
    for (const copy of out.nodes) for (const k of ['selected', 'dragging', 'measured', 'resizing']) expect(copy).not.toHaveProperty(k);

    expect(out.edges).toHaveLength(1);
    const [e2] = out.edges;
    expect(e2.id).toMatch(/^e_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(e2).toMatchObject({ source: x2.id, target: y2.id, sourceHandle: 'right', targetHandle: 'left', data: { label: 'calls' } });
    expect(e2.data).not.toBe(e.data);
    expect(e2).not.toHaveProperty('selected');
    expect(out.idMap).toEqual(new Map([[x.id, x2.id], [y.id, y2.id]]));
  });
  it('duplicates text and sticky nodes with their kind fields and id prefix (Review Focus 3)', () => {
    const text: CanvasNode = { ...node('text_T', 0), data: { label: 't', shape: 'text', color: 'neutral', autoWidth: false } };
    const sticky: CanvasNode = {
      ...node('sticky_S', 100),
      data: { label: 's', shape: 'sticky', color: '#FDE68A', text: { size: 'l', align: 'left', valign: 'top', bold: false } },
    };
    const out = duplicateSelection([text, sticky], []);
    expect(out.nodes[0].id).toMatch(/^text_/);
    expect(out.nodes[1].id).toMatch(/^sticky_/);
    expect(out.nodes[0].data).toEqual(text.data);
    expect(out.nodes[1].data).toEqual(sticky.data);
    expect(out.nodes[0].data).not.toBe(text.data);
    expect(out.nodes[1].data).not.toBe(sticky.data);
  });
});
