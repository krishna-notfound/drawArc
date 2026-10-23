// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readGlobalsCss } from '../../helpers/globals-css';

const css = readGlobalsCss();
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };

describe('stylesheet ordering (AC-003)', () => {
  it('imports tailwindcss, then the React Flow stylesheet, before any :root/@theme block', () => {
    const tailwind = css.indexOf('@import "tailwindcss";');
    const xyflow = css.indexOf('@import "@xyflow/react/dist/style.css";');
    const firstBlock = Math.min(
      ...[':root', '@theme'].map((token) => css.indexOf(token)).filter((index) => index !== -1),
    );
    expect(tailwind).toBe(0);
    expect(xyflow).toBeGreaterThan(tailwind);
    expect(firstBlock).toBeGreaterThan(xyflow);
  });

  it('places the React Flow import immediately after tailwindcss', () => {
    const lines = css
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    expect(lines[0]).toBe('@import "tailwindcss";');
    expect(lines[1]).toBe('@import "@xyflow/react/dist/style.css";');
  });

  it('pins @xyflow/react to ~12.12 as a dependency (D-023)', () => {
    expect(pkg.dependencies?.['@xyflow/react']).toMatch(/^~12\.12/);
  });
});
