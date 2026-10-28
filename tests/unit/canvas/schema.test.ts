// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, expectTypeOf, it } from 'vitest';

import * as schemaModule from '@/lib/canvas/schema';
import { type CanvasDocumentParsed, MAX_EDGES, MAX_NODES, migrate, validateDocument } from '@/lib/canvas/schema';
import { CANVAS_SCHEMA_VERSION, type CanvasDocument, MIN_SIZES } from '@/types/canvas';
import { makeCanvasDocument, testUlid } from '@/tests/factories';

const FIXTURE_DIR = 'tests/fixtures/canvas';
const load = (name: string) => JSON.parse(readFileSync(`${FIXTURE_DIR}/${name}`, 'utf8')) as CanvasDocument;
const v1Small = load('v1-small.json');
const v2Small = load('v2-small.json');
const v2Kinds = load('v2-kinds.json');

type Mutation = [name: string, mutate: (doc: CanvasDocument) => unknown, path: (string | number)[], message?: RegExp];

/** Every invalid-document rule of FR-004 / P-06-5, applied to the 5-node document (AC-005). */
const MUTATIONS: Mutation[] = [
  ['bad node id', (d) => ((d.nodes[0].id = 'rectangle_123'), d), ['nodes', 0, 'id']],
  ['node id with a foreign shape prefix', (d) => ((d.nodes[0].id = `star_${testUlid(99)}`), d), ['nodes', 0, 'id']],
  ['unknown shape', (d) => (((d.nodes[1].data as { shape: string }).shape = 'star'), d), ['nodes', 1, 'data', 'shape']],
  ['unknown colour', (d) => (((d.nodes[1].data as { color: string }).color = 'rgb(0,0,0)'), d), ['nodes', 1, 'data', 'color']],
  ['width 47', (d) => ((d.nodes[2].width = 47), d), ['nodes', 2, 'width']],
  ['height 31', (d) => ((d.nodes[2].height = 31), d), ['nodes', 2, 'height']],
  ['label of 501 chars', (d) => ((d.nodes[0].data.label = 'x'.repeat(501)), d), ['nodes', 0, 'data', 'label']],
  ['extra key on data', (d) => ({ ...d, nodes: [{ ...d.nodes[0], data: { ...d.nodes[0].data, x: 1 } }, ...d.nodes.slice(1)] }), ['nodes', 0, 'data']],
  ['runtime field on a node', (d) => ({ ...d, nodes: [{ ...d.nodes[0], selected: true }, ...d.nodes.slice(1)] }), ['nodes', 0]],
  ['schemaVersion 3', (d) => ({ ...d, schemaVersion: 3 }), ['schemaVersion']],
  ['position.x NaN', (d) => ((d.nodes[3].position.x = Number.NaN), d), ['nodes', 3, 'position', 'x']],
  ['position.y Infinity', (d) => ((d.nodes[3].position.y = Number.POSITIVE_INFINITY), d), ['nodes', 3, 'position', 'y']],
  ["sourceHandle 'middle'", (d) => (((d.edges[0] as { sourceHandle: string }).sourceHandle = 'middle'), d), ['edges', 0, 'sourceHandle']],
  ['edge to a missing node', (d) => ((d.edges[1].target = `rectangle_${testUlid(999)}`), d), ['edges', 1, 'target'], /e_\w+ references missing node/],
  ['self-loop edge', (d) => ((d.edges[2].target = d.edges[2].source), d), ['edges', 2, 'target'], /e_\w+ is a self-loop/],
  ['duplicate node id', (d) => ((d.nodes[4].id = d.nodes[0].id), d), ['nodes', 4, 'id'], /Duplicate node id/],
  ['duplicate edge id', (d) => ((d.edges[3].id = d.edges[0].id), d), ['edges', 3, 'id'], /Duplicate edge id/],
];

describe('CanvasDocumentSchema v2', () => {
  it('z.infer of the schema and CanvasDocument are mutually assignable (AC-002)', () => {
    expectTypeOf<CanvasDocumentParsed>().toMatchTypeOf<CanvasDocument>();
    expectTypeOf<CanvasDocument>().toMatchTypeOf<CanvasDocumentParsed>();
  });

  it.each([
    ['empty', makeCanvasDocument({ nodes: 0 })],
    ['small-5-nodes', makeCanvasDocument({ nodes: 5 })],
    ['large-500-nodes', makeCanvasDocument({ nodes: 500 })],
    ['v2-small', v2Small],
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

describe('migrateV1ToV2 (AC-001, EC-001, EC-002)', () => {
  it('stamps 2 and changes nothing else; validateDocument(migrate(v1)) equals v2-small.json', () => {
    const migrated = migrate(structuredClone(v1Small));
    expect(migrated).toEqual(v2Small);
    const result = validateDocument(migrated);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(v2Small);
    expect(typeof schemaModule.migrateV1ToV2).toBe('function');
    expect(CANVAS_SCHEMA_VERSION).toBe(2);
  });

  it('does not throw on a malformed v1 object and validation then names the missing field', () => {
    const result = validateDocument(migrate({ schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.map((i) => i.path)).toContainEqual(['nodes']);
  });

  it('returns a newer-version document unchanged, which validation then rejects on schemaVersion', () => {
    const newer = { schemaVersion: 3, nodes: [], edges: [] };
    const migrated = migrate(newer);
    expect(migrated).toEqual(newer);
    const result = validateDocument(migrated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.map((i) => i.path)).toContainEqual(['schemaVersion']);
  });
});

describe('schema v2 kinds and reserved fields (AC-002, AC-003, AC-005)', () => {
  // Node index map: 0-5 shapes in NODE_SHAPES order, 6 text, 7 sticky, 8 line, 9 freehand, 10 frame, 11 image.
  const data = (d: CanvasDocument, i: number) => d.nodes[i].data as Record<string, unknown>;
  const V2_MUTATIONS: Mutation[] = [
    ['rectangle with points', (d) => ((data(d, 0).points = [[0, 0], [1, 1]]), d), ['nodes', 0, 'data']],
    ['text without autoWidth', (d) => (delete data(d, 6).autoWidth, d), ['nodes', 6, 'data', 'autoWidth']],
    ['image without image', (d) => (delete data(d, 11).image, d), ['nodes', 11, 'data', 'image']],
    ['colour #FFF', (d) => ((data(d, 1).color = '#FFF'), d), ['nodes', 1, 'data', 'color']],
    ['colour rgb(0,0,0)', (d) => ((data(d, 1).color = 'rgb(0,0,0)'), d), ['nodes', 1, 'data', 'color']],
    ['text_ id on a sticky', (d) => ((d.nodes[7].id = `text_${testUlid(77)}`), d), ['nodes', 7, 'id']],
    ['frame with a parentId', (d) => ((d.nodes[10].parentId = d.nodes[10].id), d), ['nodes', 10, 'parentId']],
    ['parentId pointing at a rectangle', (d) => ((d.nodes[2].parentId = d.nodes[0].id), d), ['nodes', 2, 'parentId']],
    ['order of 65 chars', (d) => ((data(d, 0).order = 'a'.repeat(65)), d), ['nodes', 0, 'data', 'order']],
    ['javascript: href', (d) => ((data(d, 0).href = 'javascript:alert(1)'), d), ['nodes', 0, 'data', 'href']],
    ['sticky 74 wide', (d) => ((d.nodes[7].width = 74), d), ['nodes', 7, 'width']],
    ['text 23 wide', (d) => ((d.nodes[6].width = 23), d), ['nodes', 6, 'width']],
    ['rectangle 47 wide', (d) => ((d.nodes[0].width = 47), d), ['nodes', 0, 'width']],
    ['edge style width 4', (d) => ((d.edges[0].data!.style!.width = 4 as never), d), ['edges', 0, 'data', 'style', 'width']],
    ['edge style path curvy', (d) => ((d.edges[0].data!.style!.path = 'curvy' as never), d), ['edges', 0, 'data', 'style', 'path']],
    ['edge from a text node', (d) => ((d.edges[0].source = d.nodes[6].id), d), ['edges', 0, 'source']],
    ['edge from a frame', (d) => ((d.edges[0].source = d.nodes[10].id), d), ['edges', 0, 'source']],
    ['edge from a line', (d) => ((d.edges[0].source = d.nodes[8].id), d), ['edges', 0, 'source']],
    ['edge to a freehand', (d) => ((d.edges[0].target = d.nodes[9].id), d), ['edges', 0, 'target']],
  ];

  it('accepts v2-kinds.json unchanged', () => {
    const result = validateDocument(structuredClone(v2Kinds));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(v2Kinds);
  });

  it.each(V2_MUTATIONS)('rejects %s at the offending path', (_name, mutate, path) => {
    const result = validateDocument(mutate(structuredClone(v2Kinds)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.error.issues.find((i) => JSON.stringify(i.path) === JSON.stringify(path));
    expect(issue, JSON.stringify(result.error.issues)).toBeDefined();
  });

  it('accepts the minimum sizes 75x75, 24x20, 48x32', () => {
    const doc = structuredClone(v2Kinds);
    for (const i of [0, 6, 7]) {
      const { width, height } = MIN_SIZES[doc.nodes[i].data.shape];
      doc.nodes[i].width = width;
      doc.nodes[i].height = height;
    }
    expect(validateDocument(doc).ok).toBe(true);
    expect(MIN_SIZES.sticky).toEqual({ width: 75, height: 75 });
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
