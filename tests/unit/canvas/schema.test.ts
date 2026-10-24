// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, expectTypeOf, it } from 'vitest';

import * as schemaModule from '@/lib/canvas/schema';
import { type CanvasDocumentParsed, MAX_EDGES, MAX_NODES, migrate, validateDocument } from '@/lib/canvas/schema';
import { CANVAS_SCHEMA_VERSION, type CanvasDocument } from '@/types/canvas';
import { makeCanvasDocument, testUlid } from '@/tests/factories';

const FIXTURE_DIR = 'tests/fixtures/canvas';
const v1Small = JSON.parse(readFileSync(`${FIXTURE_DIR}/v1-small.json`, 'utf8')) as CanvasDocument;

type Mutation = [name: string, mutate: (doc: CanvasDocument) => unknown, path: (string | number)[], message?: RegExp];

/** Every invalid-document rule of FR-004 / P-06-5, applied to the 5-node document (AC-005). */
const MUTATIONS: Mutation[] = [
  ['bad node id', (d) => ((d.nodes[0].id = 'rectangle_123'), d), ['nodes', 0, 'id']],
  ['node id with a foreign shape prefix', (d) => ((d.nodes[0].id = `star_${testUlid(99)}`), d), ['nodes', 0, 'id']],
  ['unknown shape', (d) => (((d.nodes[1].data as { shape: string }).shape = 'star'), d), ['nodes', 1, 'data', 'shape']],
  ['unknown colour', (d) => (((d.nodes[1].data as { color: string }).color = '#ff0000'), d), ['nodes', 1, 'data', 'color']],
  ['width 47', (d) => ((d.nodes[2].width = 47), d), ['nodes', 2, 'width']],
  ['height 31', (d) => ((d.nodes[2].height = 31), d), ['nodes', 2, 'height']],
  ['label of 501 chars', (d) => ((d.nodes[0].data.label = 'x'.repeat(501)), d), ['nodes', 0, 'data', 'label']],
  ['extra key on data', (d) => ({ ...d, nodes: [{ ...d.nodes[0], data: { ...d.nodes[0].data, x: 1 } }, ...d.nodes.slice(1)] }), ['nodes', 0, 'data']],
  ['runtime field on a node', (d) => ({ ...d, nodes: [{ ...d.nodes[0], selected: true }, ...d.nodes.slice(1)] }), ['nodes', 0]],
  ['schemaVersion 2', (d) => ({ ...d, schemaVersion: 2 }), ['schemaVersion']],
  ['position.x NaN', (d) => ((d.nodes[3].position.x = Number.NaN), d), ['nodes', 3, 'position', 'x']],
  ['position.y Infinity', (d) => ((d.nodes[3].position.y = Number.POSITIVE_INFINITY), d), ['nodes', 3, 'position', 'y']],
  ["sourceHandle 'middle'", (d) => (((d.edges[0] as { sourceHandle: string }).sourceHandle = 'middle'), d), ['edges', 0, 'sourceHandle']],
  ['edge to a missing node', (d) => ((d.edges[1].target = `rectangle_${testUlid(999)}`), d), ['edges', 1, 'target'], /e_\w+ references missing node/],
  ['self-loop edge', (d) => ((d.edges[2].target = d.edges[2].source), d), ['edges', 2, 'target'], /e_\w+ is a self-loop/],
  ['duplicate node id', (d) => ((d.nodes[4].id = d.nodes[0].id), d), ['nodes', 4, 'id'], /Duplicate node id/],
  ['duplicate edge id', (d) => ((d.edges[3].id = d.edges[0].id), d), ['edges', 3, 'id'], /Duplicate edge id/],
];

describe('CanvasDocumentSchema v1', () => {
  it('z.infer of the schema is exactly CanvasDocument (AC-002)', () => {
    expectTypeOf<CanvasDocumentParsed>().toEqualTypeOf<CanvasDocument>();
  });

  it.each([
    ['empty', makeCanvasDocument({ nodes: 0 })],
    ['small-5-nodes', makeCanvasDocument({ nodes: 5 })],
    ['large-500-nodes', makeCanvasDocument({ nodes: 500 })],
    ['v1-small', v1Small],
  ])('accepts the %s document unchanged (AC-004)', (_name, doc) => {
    const result = validateDocument(doc);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(doc);
  });

  it.each(MUTATIONS)('rejects %s with an issue at the offending path (AC-005)', (_name, mutate, path, message) => {
    const result = validateDocument(mutate(structuredClone(makeCanvasDocument({ nodes: 5 }))));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.error.issues.find((i) => JSON.stringify(i.path) === JSON.stringify(path));
    expect(issue, JSON.stringify(result.error.issues)).toBeDefined();
    if (message) expect(issue?.message).toMatch(message);
  });

  it('caps nodes at MAX_NODES and edges at MAX_EDGES (EC-010)', () => {
    const tooManyNodes = makeCanvasDocument({ nodes: MAX_NODES + 1, edges: 0 });
    const nodesResult = validateDocument(tooManyNodes);
    expect(nodesResult.ok).toBe(false);
    if (!nodesResult.ok) expect(nodesResult.error.issues[0]).toMatchObject({ code: 'too_big', path: ['nodes'] });

    const base = makeCanvasDocument({ nodes: 2, edges: 1 });
    const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({ ...base.edges[0], id: `e_${testUlid(i + 1)}` }));
    const edgesResult = validateDocument({ ...base, edges });
    expect(edgesResult.ok).toBe(false);
    if (!edgesResult.ok) expect(edgesResult.error.issues[0]).toMatchObject({ code: 'too_big', path: ['edges'] });
  });
});

describe('migrate (AC-006, EC-012)', () => {
  it('is the identity for a v1 document', () => {
    expect(migrate(structuredClone(v1Small))).toEqual(v1Small);
  });

  it('returns a newer-version document unchanged, which validation then rejects on schemaVersion', () => {
    const newer = { schemaVersion: 2, nodes: [], edges: [] };
    const migrated = migrate(newer);
    expect(migrated).toEqual(newer);
    const result = validateDocument(migrated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.map((i) => i.path)).toContainEqual(['schemaVersion']);
  });
});

describe('schema freeze guard (AC-019, P-06-6)', () => {
  it('every version below the current one has a migration export and a fixture', () => {
    const fixtures = readdirSync(FIXTURE_DIR);
    expect(fixtures.some((file) => /^v1-.+\.json$/.test(file))).toBe(true);
    for (let k = 1; k < CANVAS_SCHEMA_VERSION; k++) {
      expect(typeof (schemaModule as Record<string, unknown>)[`migrateV${k}ToV${k + 1}`]).toBe('function');
      expect(fixtures.some((file) => file.startsWith(`v${k}-`) && file.endsWith('.json'))).toBe(true);
    }
  });
});
