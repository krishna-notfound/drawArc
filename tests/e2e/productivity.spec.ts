import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import { addNodeAt, addShape, getViewport, nodePosition, openCanvas, setViewport } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F10 v2 single-user behaviour: the per-user grid, Shift+2 zoom to selection, the zoom readout and limits, and the
// undo set (content and positions only).

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

async function open(page: Page, name: string): Promise<void> {
  projectId = await createProjectFor(userA().email, name);
  await openCanvas(page, projectId);
  await closeProjectSidebar(page);
}

/** Guard: the project sidebar floats over the canvas's left edge when open (closed by default in the workspace). */
async function closeProjectSidebar(page: Page): Promise<void> {
  const close = page.getByRole('complementary', { name: 'Projects' }).getByRole('button', { name: 'Close projects sidebar' });
  if (await close.isVisible()) await close.click();
  await expect(page.getByRole('complementary', { name: 'Projects' })).toBeHidden();
}

const controls = (page: Page) => page.getByRole('toolbar', { name: 'Canvas controls' });
const control = (page: Page, name: string) => controls(page).getByRole('button', { name, exact: true });
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
/** A point on the empty pane, clear of the navbar, the minimap and the palette. */
const clickEmpty = (page: Page) => page.mouse.click(1000, 180);

/** Presses the node's centre, drags it by `delta` screen pixels and releases. */
async function dragNode(page: Page, id: string, delta: number): Promise<void> {
  const box = (await node(page, id).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + delta, from.y + delta, { steps: 6 });
  await page.mouse.up();
}

const snapState = (page: Page) =>
  page.evaluate(() => {
    const s = window.__rfStore!.getState();
    return { snapToGrid: s.snapToGrid, snapGrid: s.snapGrid };
  });

const onGrid = (p: { x: number; y: number } | null) => p !== null && p.x % 20 === 0 && p.y % 20 === 0;

test.use({ actionTimeout: 15_000 });

test("grid: Ctrl+' and the toggle snap drags to 20 px, persist across reload, and never touch undo (AC-034)", async ({ page }) => {
  test.setTimeout(150_000);
  await open(page, 'E2E F10 grid');
  const id = await addNodeAt(page, 'rectangle', { x: 33, y: 47 });
  await setViewport(page, { x: 300, y: 250, zoom: 1 });
  await clickEmpty(page);

  // The toggle is not a history entry: Undo's state is the same before and after.
  const undoDisabledBefore = await control(page, 'Undo').isDisabled();
  await expect(control(page, 'Grid')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+Quote');
  await expect(control(page, 'Grid')).toHaveAttribute('aria-pressed', 'true');
  expect(await control(page, 'Undo').isDisabled()).toBe(undoDisabledBefore);
  expect(await snapState(page)).toEqual({ snapToGrid: true, snapGrid: [20, 20] });
  // Lines variant: the background pattern holds paths (dots render circles).
  await expect(page.locator('.react-flow__background pattern path').first()).toBeAttached();

  await dragNode(page, id, 10);
  await expect.poll(async () => onGrid(await nodePosition(page, id))).toBe(true);
  expect(await nodePosition(page, id)).not.toEqual({ x: 33, y: 47 });

  // Per-user, per-browser: it survives a reload.
  await openCanvas(page, projectId!);
  await closeProjectSidebar(page);
  await expect(control(page, 'Grid')).toHaveAttribute('aria-pressed', 'true');
  expect((await snapState(page)).snapToGrid).toBe(true);

  // Off again: free drag, dots background.
  await control(page, 'Grid').click();
  await expect(control(page, 'Grid')).toHaveAttribute('aria-pressed', 'false');
  expect((await snapState(page)).snapToGrid).toBe(false);
  await expect(page.locator('.react-flow__background pattern circle').first()).toBeAttached();
  await setViewport(page, { x: 300, y: 250, zoom: 1 });
  await dragNode(page, id, 7);
  await expect.poll(async () => onGrid(await nodePosition(page, id))).toBe(false);
});

test('Shift+2 fits the selection, equals Shift+1 with nothing selected, and works from the pane menu (AC-039)', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page, 'E2E F10 zoom to selection');
  for (const at of [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 400, y: 0 },
  ]) {
    await addNodeAt(page, 'rectangle', at);
  }
  const far1 = await addNodeAt(page, 'rectangle', { x: 5000, y: 5000 });
  const far2 = await addNodeAt(page, 'rectangle', { x: 5200, y: 5000 });

  // Select the two far nodes (click, Ctrl-click) with the view on them, then look away.
  await setViewport(page, { x: -4700, y: -4700, zoom: 1 });
  await node(page, far1).click();
  await node(page, far2).click({ modifiers: ['Control'] });
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.keyboard.press('Shift+Digit2');
  const inside = async (id: string) => {
    const box = (await node(page, id).boundingBox())!;
    const vp = page.viewportSize()!;
    return box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height;
  };
  await expect.poll(async () => (await inside(far1)) && (await inside(far2)), { timeout: 2_000 }).toBe(true);
  const firstThree = await page.locator('.react-flow__node:not(.selected)').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    }),
  );
  expect(firstThree.some((visible) => !visible)).toBe(true);

  // Nothing selected: Shift+2 is Shift+1 (fit all).
  const near = (a: { x: number; y: number; zoom: number }, b: typeof a) =>
    expect([a.x, a.y, a.zoom].map((n) => Math.round(n * 1000))).toEqual([b.x, b.y, b.zoom].map((n) => Math.round(n * 1000)));
  await clickEmpty(page);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
  await page.keyboard.press('Shift+Digit2');
  await page.waitForTimeout(450);
  const fitSelectionKey = await getViewport(page);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(450);
  near(fitSelectionKey, await getViewport(page));

  // The pane menu entry does the same.
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await page.mouse.click(1100, 200, { button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: /Zoom to selection/ }).click();
  await page.waitForTimeout(450);
  near(await getViewport(page), fitSelectionKey);
});

test('zoom readout, reset and limit buttons (AC-040)', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'E2E F10 zoom readout');
  const readout = controls(page).locator('[data-slot="zoom-readout"]');
  await expect(readout).toHaveText('100 %');
  await control(page, 'Zoom in').click();
  await expect(readout).not.toHaveText('100 %');
  await readout.click();
  await expect(readout).toHaveText('100 %');
  await expect.poll(async () => (await getViewport(page)).zoom, { timeout: 2_000 }).toBe(1);

  await page.evaluate(() => window.__rf!.zoomTo(4));
  await expect(control(page, 'Zoom in')).toBeDisabled();
  await expect(control(page, 'Zoom out')).toBeEnabled();
  await expect(readout).toHaveText('400 %');
  await page.evaluate(() => window.__rf!.zoomTo(0.1));
  await expect(control(page, 'Zoom out')).toBeDisabled();
  await expect(control(page, 'Zoom in')).toBeEnabled();
  await expect(readout).toHaveText('10 %');
});

test('undo set: non-content actions never enable Undo; mid-drag Ctrl+Z is ignored (AC-041)', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page, 'E2E F10 undo set');
  await addNodeAt(page, 'rectangle', { x: 300, y: 200 });
  await addNodeAt(page, 'circle', { x: 600, y: 200 });

  // A fresh page has a fresh history; none of these touch content or positions.
  await openCanvas(page, projectId!);
  await closeProjectSidebar(page);
  await expect(control(page, 'Undo')).toBeDisabled();
  const firstNode = page.locator('.react-flow__node').first();
  await firstNode.click(); // select
  await page.mouse.move(900, 600);
  await page.mouse.down();
  await page.mouse.move(1000, 700, { steps: 6 }); // box select on the empty pane
  await page.mouse.up();
  await page.keyboard.press('+'); // zoom
  await page.evaluate(() => window.__rf!.setViewport({ x: 50, y: 50, zoom: 1 })); // pan
  await page.keyboard.press('Control+Quote'); // grid
  await page.keyboard.press('Control+Quote');
  await page.keyboard.press('?'); // cheat-sheet
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
  await expect(control(page, 'Undo')).toBeDisabled();
  expect(await page.evaluate(() => window.__history!.canUndo())).toBe(false);

  // Mid-drag Ctrl+Z is ignored: the node being dragged is neither removed nor rolled back.
  const id = await addShape(page, 'circle');
  await expect(control(page, 'Undo')).toBeEnabled();
  const before = (await nodePosition(page, id))!;
  const box = (await node(page, id).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const count = await page.locator('.react-flow__node').count();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 40, { steps: 4 });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  await expect(page.locator('.react-flow__node')).toHaveCount(count);
  expect(await page.evaluate(() => window.__history!.canUndo())).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => ((await nodePosition(page, id))!.x - before.x) > 20).toBe(true);
});

