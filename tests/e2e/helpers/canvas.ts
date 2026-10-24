import { expect, type Page } from '@playwright/test';

import type { NodeShape } from '@/types/canvas';

/**
 * Canvas helpers shared by the workspace specs (F07+). The app under test runs with NEXT_PUBLIC_E2E_HOOKS=1, so
 * `window.__rf` (React Flow instance) and `window.__canvasMutations` exist. Nodes are created only through the F07
 * palette, the same path a user takes.
 */

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export async function openCanvas(page: Page, projectId: string, canWrite = true): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/editor/${projectId}`);
  await expect(page.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', String(canWrite), {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__rf !== undefined);
}

export async function setViewport(page: Page, viewport: Viewport): Promise<void> {
  await page.evaluate((vp) => window.__rf!.setViewport(vp), viewport);
}

export function getViewport(page: Page): Promise<Viewport> {
  return page.evaluate(() => window.__rf!.getViewport());
}

export const paletteButton = (page: Page, shape: NodeShape) => page.getByRole('button', { name: `Add ${shape}` });

/** Presses `shape` in the palette and drags it to client point `to` without releasing. */
export async function startShapeDrag(page: Page, shape: NodeShape, to: { x: number; y: number }): Promise<void> {
  const box = (await paletteButton(page, shape).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

/** Drags `shape` from the palette and drops it at client point `to`; resolves once the node is rendered. */
export async function dropShape(page: Page, shape: NodeShape, to: { x: number; y: number }): Promise<string> {
  const before = await page.locator('.react-flow__node').count();
  await startShapeDrag(page, shape, to);
  await page.mouse.up();
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
  return selectedNodeId(page);
}

/** Places `shape` at the canvas centre with a plain click (F07 FR-007); returns the new node's id. */
export async function addShape(page: Page, shape: NodeShape): Promise<string> {
  const before = await page.locator('.react-flow__node').count();
  await paletteButton(page, shape).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
  return selectedNodeId(page);
}

/** A just-created node is the only selected one (F07 FR-008). */
async function selectedNodeId(page: Page): Promise<string> {
  const selected = page.locator('.react-flow__node.selected');
  await expect(selected).toHaveCount(1);
  return (await selected.getAttribute('data-id'))!;
}

export async function centreOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
