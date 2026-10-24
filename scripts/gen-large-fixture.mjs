// Writes tests/fixtures/canvas/large-500-nodes.json (F15 T-012): the NFR-004 envelope as a schema-v1 canvas.
// Deterministic (re-running yields identical bytes): a 25 x 20 grid of 160 x 80 nodes on a 240 x 160 pitch (no
// overlaps), and 800 edges between grid neighbours (all 480 horizontal links, then the first 320 vertical ones).
// Usage: node scripts/gen-large-fixture.mjs
import { writeFileSync } from 'node:fs';

const COLS = 25;
const ROWS = 20;
const EDGES = 800;
const SHAPES = ['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'];
const COLORS = ['neutral', 'blue', 'purple', 'orange', 'red', 'pink', 'green', 'teal'];
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (ULID)

/** A fixed-time ULID whose random part encodes `n`: unique, valid, and stable across runs. */
function ulid(prefix, n) {
  let tail = '';
  for (let v = n, i = 0; i < 16 - prefix.length; i++, v = Math.floor(v / 32)) tail = ALPHABET[v % 32] + tail;
  return `01JBE00000${prefix}${tail}`;
}

const nodes = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const i = row * COLS + col;
    const shape = SHAPES[i % SHAPES.length];
    nodes.push({
      id: `${shape}_${ulid('N', i)}`,
      type: 'canvasNode',
      position: { x: col * 240, y: row * 160 },
      width: 160,
      height: 80,
      data: { label: `Service ${i + 1}`, shape, color: COLORS[i % COLORS.length] },
    });
  }
}

const at = (row, col) => nodes[row * COLS + col].id;
const links = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS - 1; col++) links.push([at(row, col), at(row, col + 1), 'right', 'left']);
}
for (let row = 0; row < ROWS - 1; row++) {
  for (let col = 0; col < COLS; col++) links.push([at(row, col), at(row + 1, col), 'bottom', 'top']);
}
const edges = links.slice(0, EDGES).map(([source, target, sourceHandle, targetHandle], i) => ({
  id: `e_${ulid('E', i)}`,
  type: 'canvasEdge',
  source,
  target,
  sourceHandle,
  targetHandle,
}));

writeFileSync('tests/fixtures/canvas/large-500-nodes.json', `${JSON.stringify({ schemaVersion: 1, nodes, edges })}\n`);
console.log(`large-500-nodes.json: ${nodes.length} nodes, ${edges.length} edges`);
