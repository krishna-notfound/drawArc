// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const scripts = Object.keys((JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts);
const scriptsSection = readme.split(/^## Scripts$/m)[1]?.split(/^## /m)[0] ?? '';

describe('README.md (F00 AC-026)', () => {
  it('describes drawArc', () => {
    expect(readme).toContain('drawArc');
  });

  it('lists every npm script in a Scripts section', () => {
    expect(scriptsSection).not.toBe('');
    scripts.forEach((name) => expect(scriptsSection).toContain(`\`${name}\``));
  });

  it('points to the planning documents', () => {
    expect(readme).toContain('context/README.md');
    expect(readme).toContain('features/README.md');
  });

  it('mentions Ghost AI only as the former name', () => {
    readme
      .split(/\r?\n/)
      .filter((line) => line.includes('Ghost AI'))
      .forEach((line) => expect(line).toMatch(/former/i));
  });
});
