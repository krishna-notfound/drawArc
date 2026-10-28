import { afterEach, describe, expect, it, vi } from 'vitest';

import { fontsReady, measureText } from '@/lib/canvas/text-measure';
import { textStyle } from '@/lib/canvas/text-style';
import { DEFAULT_TEXT } from '@/types/canvas';

const style = textStyle(DEFAULT_TEXT.text);

afterEach(() => vi.restoreAllMocks());

describe('measureText / fontsReady (F22 FR-010, EC-005)', () => {
  it('measures a hidden body-level mirror and returns the ceiled border-box size', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 108.2, height: 15.6 } as DOMRect);
    expect(measureText({ text: 'Hello world', style, padding: { x: 6, y: 4 } })).toEqual({ width: 109, height: 16 });
    const mirror = document.querySelector<HTMLElement>('[data-slot="text-mirror"]')!;
    expect(mirror.style.whiteSpace).toBe('pre');
    expect(mirror.style.padding).toBe('4px 6px');
    expect(mirror.style.fontSize).toBe('14px');
    measureText({ text: 'wrap me', style, padding: { x: 12, y: 12 }, width: 250 });
    expect(mirror.style.whiteSpace).toBe('pre-wrap');
    expect(mirror.style.width).toBe('250px');
    expect(document.querySelectorAll('[data-slot="text-mirror"]')).toHaveLength(1);
  });

  it('fontsReady awaits document.fonts.ready once and caches the promise', async () => {
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
    expect(fontsReady()).toBe(fontsReady());
    await expect(fontsReady()).resolves.toBeUndefined();
  });
});
