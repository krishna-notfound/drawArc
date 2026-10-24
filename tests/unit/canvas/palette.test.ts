// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { NODE_COLOR_IDS, NODE_COLORS } from '@/types/canvas';
import { USER_COLORS } from '@/types/liveblocks.config';

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('node palette (AC-003)', () => {
  it.each(NODE_COLOR_IDS)('%s text on fill meets 4.5:1', (id) => {
    expect(contrast(NODE_COLORS[id].text, NODE_COLORS[id].fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('USER_COLORS equal the seven non-neutral text colours in order (F05 P-05-6)', () => {
    expect([...USER_COLORS]).toEqual(NODE_COLOR_IDS.filter((id) => id !== 'neutral').map((id) => NODE_COLORS[id].text));
  });
});
