// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { blockBody, declarations, readGlobalsCss } from '../../helpers/globals-css';

const root = new Map(declarations(blockBody(readGlobalsCss(), ':root')));

function rgb(variable: string): [number, number, number] {
  const value = root.get(variable);
  const match = value?.match(/^#([0-9a-f]{6})$/);
  if (!match) throw new Error(`${variable} is not a 6-digit hex colour: ${value}`);
  const hex = match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(rgb(fg)), luminance(rgb(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

type Pair = [string, string];
const ALL_BACKGROUNDS = ['--bg-base', '--bg-surface', '--bg-elevated', '--bg-subtle'];
const pairs: Pair[] = [
  ...['--text-primary', '--text-secondary'].flatMap((fg) => ALL_BACKGROUNDS.map((bg): Pair => [fg, bg])),
  ...['--bg-base', '--bg-surface', '--bg-elevated'].map((bg): Pair => ['--text-muted', bg]),
  ...['--accent-primary', '--accent-ai-text', '--state-error', '--state-success', '--state-warning'].map(
    (fg): Pair => [fg, '--bg-base'],
  ),
  ['--accent-ai-foreground', '--accent-ai'],
];

describe('token contrast (AC-026, NFR-006)', () => {
  it.each(pairs)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('records the decorative-only pairs (EC-010)', () => {
    const informational = [
      ['--text-muted', '--bg-subtle'],
      ['--text-faint', '--bg-base'],
    ].map(([fg, bg]) => `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
    process.stdout.write(`[contrast] decorative-only ${informational.join('; ')}\n`);
    expect(informational).toHaveLength(2);
  });
});
