// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PALETTE = /\b(bg|text|border|ring|from|to|via)-(zinc|gray|slate|neutral|stone|white|black)\b/;

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir, { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }
  return entries
    .map((entry) => join(dir, entry).replaceAll('\\', '/'))
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.startsWith('components/ui/'));
}

describe('no raw colours outside tokens (AC-025)', () => {
  it('the patterns catch what they are meant to catch', () => {
    expect(HEX.test('color: "#1e1e23"')).toBe(true);
    expect(PALETTE.test('className="bg-zinc-900 text-white"')).toBe(true);
    expect(PALETTE.test('className="bg-base text-copy-primary bg-ai"')).toBe(false);
  });

  it('finds no hex literal or raw palette class in app/** and components/** (minus components/ui)', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('components')];
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (HEX.test(line) || PALETTE.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
