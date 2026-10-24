// @vitest-environment node
import { readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

import { validateDocument } from '@/lib/canvas/schema';

// F15 AC-018 / TC-009: the NFR-004 fixture that perf.spec.ts seeds through the snapshot API.
it('is a valid schema-v1 canvas of exactly 500 non-overlapping nodes and 800 edges within the size caps', () => {
  const text = readFileSync('tests/fixtures/canvas/large-500-nodes.json', 'utf8');
  const result = validateDocument(JSON.parse(text));
  if (!result.ok) throw result.error;
  const { nodes, edges } = result.doc;

  expect(nodes).toHaveLength(500);
  expect(edges).toHaveLength(800);
  // Under F13's 4 MB request cap, hence under NFR-004's 5 MB room Storage budget.
  expect(Buffer.byteLength(JSON.stringify({ document: result.doc }))).toBeLessThan(4 * 1024 * 1024);

  const overlaps = nodes.some((a, i) =>
    nodes.some(
      (b, j) =>
        j > i &&
        a.position.x < b.position.x + b.width &&
        b.position.x < a.position.x + a.width &&
        a.position.y < b.position.y + b.height &&
        b.position.y < a.position.y + a.height,
    ),
  );
  expect(overlaps).toBe(false);
});
