import { expect, type Page } from '@playwright/test';

import type { NodeShape, PaletteKind } from '@/types/canvas';

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

const PALETTE_NAMES: Partial<Record<PaletteKind, string>> = { text: 'Add text', sticky: 'Add sticky note' };
export const paletteButton = (page: Page, shape: PaletteKind) =>
  page.getByRole('button', { name: PALETTE_NAMES[shape] ?? `Add ${shape}` });

/** Presses `shape` in the palette and drags it to client point `to` without releasing. */
export async function startShapeDrag(page: Page, shape: PaletteKind, to: { x: number; y: number }): Promise<void> {
  const box = (await paletteButton(page, shape).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

/** Drags `shape` from the palette and drops it at client point `to`; resolves once the node is rendered. */
export async function dropShape(page: Page, shape: PaletteKind, to: { x: number; y: number }): Promise<string> {
  const before = await page.locator('.react-flow__node').count();
  await startShapeDrag(page, shape, to);
  await page.mouse.up();
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
  return selectedNodeId(page);
}

/** Places `shape` at the canvas centre with a plain click (F07 FR-007); returns the new node's id. */
export async function addShape(page: Page, shape: PaletteKind): Promise<string> {
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

/** Adds a node through the F07 write path (no palette drag) at flow position `position`; returns its id. */
export async function addNodeAt(page: Page, shape: NodeShape, position: { x: number; y: number }): Promise<string> {
  const before = await page.locator('.react-flow__node').count();
  const id = await page.evaluate(([s, p]) => window.__canvasMutations!.addNode(s, p)?.id ?? null, [shape, position] as const);
  expect(id).not.toBeNull();
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
  return id!;
}

/** A node's stored top-left position in flow coordinates. */
export function nodePosition(page: Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((nodeId) => window.__rf!.getNode(nodeId)?.position ?? null, id);
}

/**
 * Presses a modifier-less key with the canvas focused: a click on empty pane first, then the key (F22 T / N). T and N
 * insert centred on the pointer (registry insert keys, F10 v2), so `at` is where the new node lands.
 */
export async function pressCanvasKey(page: Page, key: 't' | 'n', at = { x: 1000, y: 180 }): Promise<void> {
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press(key);
}
