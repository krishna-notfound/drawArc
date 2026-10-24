// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildEdge, isAllowedConnection } from '@/lib/canvas/connections';
import type { CanvasEdge } from '@/types/canvas';

const EXISTING: CanvasEdge[] = [
  { id: 'e_1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', type: 'canvasEdge', data: {} },
];
const conn = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({
  source,
  sourceHandle,
  target,
  targetHandle,
});

describe('connection rules (F09 AC-007, EC-006)', () => {
  it.each([
    ['self-loop a.top → a.bottom', conn('a', 'top', 'a', 'bottom'), false],
    ['duplicate a.right → b.left', conn('a', 'right', 'b', 'left'), false],
    ['another target handle a.right → b.top', conn('a', 'right', 'b', 'top'), true],
    ['reverse direction b.left → a.right', conn('b', 'left', 'a', 'right'), true],
    ['another source handle a.left → b.left', conn('a', 'left', 'b', 'left'), true],
  ])('%s → %s', (_name, c, allowed) => {
    expect(isAllowedConnection(c, EXISTING)).toBe(allowed);
  });

  it('ignores the edge being reconnected, so dropping it back on its own handles is allowed (EC-003)', () => {
    expect(isAllowedConnection(conn('a', 'right', 'b', 'left'), EXISTING, 'e_1')).toBe(true);
  });
});

describe('buildEdge (F09 AC-006, D-09a)', () => {
  it('builds exactly the schema-v1 edge, ignoring anything React Flow merged in from defaultEdgeOptions', () => {
    const edge = buildEdge({ ...conn('a', 'right', 'b', 'left'), type: 'canvasEdge', markerEnd: 'x' } as never);
    expect(edge).toEqual({
      id: expect.stringMatching(/^e_[0-9A-HJKMNP-TV-Z]{26}$/),
      source: 'a',
      target: 'b',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'canvasEdge',
      data: {},
    });
    expect(Object.keys(edge).sort()).toEqual(['data', 'id', 'source', 'sourceHandle', 'target', 'targetHandle', 'type']);
  });

  it('throws without a known handle id on either end', () => {
    expect(() => buildEdge({ source: 'a', target: 'b', sourceHandle: null, targetHandle: 'left' })).toThrow();
    expect(() => buildEdge({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'middle' })).toThrow();
  });
});
