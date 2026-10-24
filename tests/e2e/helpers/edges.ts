import { expect, type Locator, type Page } from '@playwright/test';

import type { CanvasEdge, HandleId } from '@/types/canvas';

/** F09 edge helpers (React Flow DOM + the E2E hooks `window.__rf` / `__canvasMutations` / `__history`). */

export type Point = { x: number; y: number };

export const handle = (page: Page, nodeId: string, id: HandleId): Locator =>
  page.locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${id}"]`);

export const edgeGroup = (page: Page, id: string): Locator => page.locator(`.react-flow__edge[data-id="${id}"]`);

export async function centre(locator: Locator): Promise<Point> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on a handle of `nodeId` (hovering the node first, as a user does) and releases at `to`. */
export async function dragFromHandle(page: Page, nodeId: string, id: HandleId, to: Point): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).hover();
  const from = await centre(handle(page, nodeId, id));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function connect(page: Page, from: [string, HandleId], to: [string, HandleId]): Promise<void> {
  await dragFromHandle(page, from[0], from[1], await centre(handle(page, to[0], to[1])));
}

/** The edges as stored (React Flow's controlled list, fed only by Liveblocks Storage). */
export function edges(page: Page): Promise<CanvasEdge[]> {
  return page.evaluate(() =>
    window.__rf!.getEdges().map(({ id, source, target, sourceHandle, targetHandle, type, data }) => ({
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      type,
      data,
    })),
  ) as Promise<CanvasEdge[]>;
}

export async function expectEdgeCount(page: Page, count: number, timeout = 5_000): Promise<void> {
  await expect.poll(async () => (await edges(page)).length, { timeout }).toBe(count);
}

export async function onlyEdge(page: Page): Promise<CanvasEdge> {
  await expectEdgeCount(page, 1);
  return (await edges(page))[0];
}

export function deleteEdge(page: Page, id: string): Promise<void> {
  return page.evaluate((edgeId) => {
    const edge = window.__rf!.getEdge(edgeId)!;
    window.__canvasMutations!.onDelete({ nodes: [], edges: [edge] });
  }, id);
}

/** Midpoint of the visible path in client coordinates (where the label badge sits). */
export function pathMidpoint(page: Page, id: string): Promise<Point> {
  return edgeGroup(page, id)
    .locator('path.react-flow__edge-path')
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const m = path.getScreenCTM()!;
      return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
    });
}

/** Drags the reconnect anchor at an edge's target end and releases at `to`. */
export async function dragTargetEnd(page: Page, id: string, to: Point): Promise<void> {
  const anchor = edgeGroup(page, id).locator('.react-flow__edgeupdater-target');
  const from = await centre(anchor);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function pathStyle(page: Page, id: string) {
  return edgeGroup(page, id)
    .locator('path.react-flow__edge-path')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { stroke: s.stroke, opacity: s.strokeOpacity, width: s.strokeWidth, cap: s.strokeLinecap };
    });
}
