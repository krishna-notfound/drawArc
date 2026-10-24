import { renderHook } from '@testing-library/react';
import { ReactFlowProvider, useReactFlow, useStoreApi } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { centredDropPosition } from '@/lib/canvas/drop-position';
import { DEFAULT_SIZES, NODE_SHAPES } from '@/types/canvas';

describe('centredDropPosition (F07 AC-007)', () => {
  it('subtracts half the node size from the flow point', () => {
    expect(centredDropPosition({ x: 100, y: 200 }, { width: 180, height: 80 })).toEqual({ x: 10, y: 160 });
    expect(centredDropPosition({ x: 100, y: 200 }, { width: 96, height: 96 })).toEqual({ x: 52, y: 152 });
  });
});

describe('drop maths at any pan/zoom (F07 FR-004, AC-008 unit half — reference bug §4)', () => {
  // The palette's real path: React Flow's screenToFlowPosition, then centredDropPosition. The node's centre,
  // mapped back to the screen through the same transform and container offset, must land on the pointer.
  const CONTAINER = { x: 37, y: 52 }; // the flow root is not at the window origin (e.g. below a banner)
  const POINTERS = [
    { x: 500, y: 400 },
    { x: 0, y: 0 },
    { x: 1279, y: 799 },
  ];

  it.each([0.5, 1, 1.3, 2])('zoom %s with a (-640, 480) pan', (zoom) => {
    const { result } = renderHook(() => ({ rf: useReactFlow(), store: useStoreApi() }), { wrapper: ReactFlowProvider });
    const domNode = document.createElement('div');
    domNode.getBoundingClientRect = () => ({ ...CONTAINER, left: CONTAINER.x, top: CONTAINER.y }) as DOMRect;
    const pan = { x: -640, y: 480 };
    result.current.store.setState({ domNode, transform: [pan.x, pan.y, zoom] });

    for (const pointer of POINTERS) {
      for (const shape of NODE_SHAPES) {
        const size = DEFAULT_SIZES[shape];
        const position = centredDropPosition(result.current.rf.screenToFlowPosition(pointer), size);
        const centreOnScreen = {
          x: (position.x + size.width / 2) * zoom + pan.x + CONTAINER.x,
          y: (position.y + size.height / 2) * zoom + pan.y + CONTAINER.y,
        };
        expect(centreOnScreen.x).toBeCloseTo(pointer.x, 6);
        expect(centreOnScreen.y).toBeCloseTo(pointer.y, 6);
      }
    }
  });
});
