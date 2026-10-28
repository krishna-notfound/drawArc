// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { contrastRatio, resolveColor, textContrastOk } from '@/lib/canvas/color';
import { NODE_COLOR_IDS, NODE_COLORS, NODE_KINDS } from '@/types/canvas';

describe('resolveColor / textContrastOk (F22 AC-004)', () => {
  it.each(NODE_COLOR_IDS)('palette id %s returns the NODE_COLORS pair and passes textContrastOk for every kind', (id) => {
    expect(resolveColor(id)).toEqual({ ...NODE_COLORS[id], custom: false });
    for (const kind of NODE_KINDS) expect(textContrastOk(kind, id), kind).toBe(true);
  });

  it('derives pure black or white for a hex fill, always >= 4.58:1', () => {
    expect(resolveColor('#FDE68A')).toEqual({ fill: '#FDE68A', text: '#000000', custom: true });
    expect(resolveColor('#1E3A8A')).toEqual({ fill: '#1E3A8A', text: '#FFFFFF', custom: true });
    const worst = resolveColor('#757575');
    expect(contrastRatio(worst.fill, worst.text)).toBeGreaterThanOrEqual(4.58);
    expect(textContrastOk('sticky', '#757575')).toBe(true);
    expect(resolveColor('#fde68a').fill).toBe('#fde68a'); // case preserved; schema accepts either
  });

  it('flags a hex that fails against --bg-base for the text kind only, but still resolves it', () => {
    expect(textContrastOk('text', '#111114')).toBe(false);
    expect(textContrastOk('rectangle', '#111114')).toBe(true);
    expect(resolveColor('#111114').fill).toBe('#111114');
  });

  it('falls back to neutral with one warning for a malformed value (EC-015)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveColor('#FFF')).toEqual({ ...NODE_COLORS.neutral, custom: false });
    expect(resolveColor('#FFF')).toEqual({ ...NODE_COLORS.neutral, custom: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(resolveColor('rgb(0,0,0)').fill).toBe(NODE_COLORS.neutral.fill);
    warn.mockRestore();
  });
});
