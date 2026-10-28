import { describe, expect, it } from 'vitest';

import { alignNodes, distributeNodes, selectedBoxes } from '@/lib/canvas/align';
import type { CanvasNode, CanvasNodeData } from '@/types/canvas';

const A = { id: 'A', x: 0, y: 0, width: 100, height: 50 };
const B = { id: 'B', x: 300, y: 200, width: 50, height: 50 };
const C = { id: 'C', x: 120, y: 80, width: 80, height: 80, locked: true };
const D = { id: 'D', x: 150, y: 300, width: 60, height: 60 };

const node = (id: string): CanvasNode => ({
  id,
  type: 'canvasNode',
  position: { x: 0, y: 0 },
  data: { label: '', shape: 'rectangle', color: 'neutral' },
});

describe('alignNodes / distributeNodes (F10 v2 TC-036)', () => {
  it('aligns the movable boxes to the bounding box of the movable set, ignoring locked ones (FR-020, EC-022)', () => {
    expect(alignNodes([A, B, C], 'left')).toEqual([{ id: 'B', position: { x: 0, y: 200 } }]);
    expect(alignNodes([A, B, C], 'right')).toEqual([{ id: 'A', position: { x: 250, y: 0 } }]);
    expect(alignNodes([A, B, C], 'top')).toEqual([{ id: 'B', position: { x: 300, y: 0 } }]);
    expect(alignNodes([A, B, C], 'bottom')).toEqual([{ id: 'A', position: { x: 0, y: 200 } }]);
    expect(alignNodes([A, B, C], 'centerH')).toEqual([
      { id: 'A', position: { x: 125, y: 0 } },
      { id: 'B', position: { x: 150, y: 200 } },
    ]);
    expect(alignNodes([A, B, C], 'middleV')).toEqual([
      { id: 'A', position: { x: 0, y: 100 } },
      { id: 'B', position: { x: 300, y: 100 } },
    ]);
  });

  it('returns [] for < 2 movable boxes and for an already-aligned set (EC-021)', () => {
    expect(alignNodes([A], 'left')).toEqual([]);
    expect(alignNodes([A, C], 'left')).toEqual([]);
    expect(alignNodes([A, { ...B, x: 0 }], 'left')).toEqual([]);
  });

  it('distributes with equal gaps, outer boxes fixed, locked excluded; [] below 3 movable (FR-021)', () => {
    expect(distributeNodes([A, B, C, D], 'h')).toEqual([{ id: 'D', position: { x: 170, y: 300 } }]); // span 0..350, sizes 100+60+50 → gap 70
    expect(distributeNodes([A, B, C, D], 'v')).toEqual([{ id: 'B', position: { x: 300, y: 150 } }]); // span 0..360, sizes 50+50+60 → gap 100
    expect(distributeNodes([A, B, C], 'h')).toEqual([]);
    const row = [
      { id: 'P', x: 0, y: 0, width: 80, height: 40 },
      { id: 'Q', x: 50, y: 0, width: 80, height: 40 },
      { id: 'R', x: 400, y: 0, width: 80, height: 40 },
    ];
    expect(distributeNodes(row, 'h')).toEqual([{ id: 'Q', position: { x: 200, y: 0 } }]); // AC-038 vector
  });

  it('selectedBoxes reads stored width/height and the optional locked flag', () => {
    const boxes = selectedBoxes([
      { ...node('A'), selected: true, width: 100, height: 50 },
      { ...node('L'), selected: true, data: { ...node('L').data, locked: true } as CanvasNodeData },
      { ...node('U'), selected: false },
    ]);
    expect(boxes.map((b) => [b.id, b.locked ?? false])).toEqual([
      ['A', false],
      ['L', true],
    ]);
    expect(boxes[0]).toMatchObject({ width: 100, height: 50 });
  });
});
