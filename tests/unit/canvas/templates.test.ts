// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { findOverlaps } from '@/lib/canvas/layout-check';
import { CanvasDocumentSchema, EdgeIdSchema, NodeIdSchema } from '@/lib/canvas/schema';
import { CANVAS_TEMPLATES, findTemplate, instantiateTemplate } from '@/lib/canvas/templates';
import type { PersistedNode } from '@/types/canvas';

// The fixtures for F13/F17 reuse (FR-014) are file snapshots of the source documents. Regenerate them after
// editing a template with: npx vitest run tests/unit/canvas/templates.test.ts -u

describe('starter templates', () => {
  it('are valid schema-v1 documents with tidy, non-overlapping layouts and matching fixtures (AC-001–003, AC-017)', async () => {
    expect(CANVAS_TEMPLATES.map((t) => t.id)).toEqual(['microservices', 'cicd-pipeline', 'event-driven']);
    expect(new Set(CANVAS_TEMPLATES.map((t) => t.name)).size).toBe(CANVAS_TEMPLATES.length);

    for (const template of CANVAS_TEMPLATES) {
      const { document } = template;
      expect(template.description.length, template.id).toBeLessThanOrEqual(120);
      // Schema v1 covers shapes, colours, sizes, handles, unique ids, existing endpoints and no self-loops.
      const parsed = CanvasDocumentSchema.safeParse(document);
      expect(parsed.success, `${template.id}: ${parsed.error?.message}`).toBe(true);
      expect(findOverlaps(document.nodes, 20), template.id).toEqual([]);
      for (const node of document.nodes) expect(node.data.label.length, node.id).toBeLessThanOrEqual(24);
      for (const edge of document.edges) expect(edge.data?.label?.length ?? 0, edge.id).toBeLessThanOrEqual(100);

      await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot(
        `../../fixtures/canvas/templates/${template.id}.json`,
      );
    }

    // The overlap check itself is not vacuous: two nodes 30 px apart violate the 40 px minimum gap.
    const node = (id: string, x: number): PersistedNode => ({
      id,
      type: 'canvasNode',
      position: { x, y: 0 },
      width: 100,
      height: 50,
      data: { label: '', shape: 'rectangle', color: 'neutral' },
    });
    expect(findOverlaps([node('a', 0), node('b', 130), node('c', 400)], 20)).toEqual([['a', 'b']]);
  });

  it('instantiates with fresh ids, so two imports never collide (AC-004)', () => {
    const template = findTemplate('microservices')!;
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);
    const sourceIds = new Set([...template.document.nodes, ...template.document.edges].map((item) => item.id));

    for (const result of [first, second]) {
      expect(result.nodes).toHaveLength(9);
      expect(result.edges).toHaveLength(8);
      const nodeIds = new Set(result.nodes.map((n) => n.id));
      for (const n of result.nodes) expect(NodeIdSchema.safeParse(n.id).success, n.id).toBe(true);
      for (const e of result.edges) {
        expect(EdgeIdSchema.safeParse(e.id).success, e.id).toBe(true);
        expect(nodeIds.has(e.source) && nodeIds.has(e.target)).toBe(true);
      }
      for (const item of [...result.nodes, ...result.edges]) expect(sourceIds.has(item.id)).toBe(false);
    }
    const firstIds = new Set([...first.nodes, ...first.edges].map((item) => item.id));
    expect([...second.nodes, ...second.edges].some((item) => firstIds.has(item.id))).toBe(false);
    // Same content, new objects: editing an imported node never mutates the template.
    expect(first.nodes[0].data).toEqual(template.document.nodes[0].data);
    expect(first.nodes[0].data).not.toBe(template.document.nodes[0].data);
  });
});
