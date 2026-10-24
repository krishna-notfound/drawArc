import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import { addShape, dropShape, getViewport, openCanvas, setViewport } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F10 single-user behaviour: control bar, zoom keys, history states, the keyboard guard, React Flow's built-in keys
// and selection semantics, the context menu and the cheat-sheet.

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

/** The desktop workspace opens with the project sidebar floating over the canvas's left edge (F04). */
async function closeProjectSidebar(page: Page): Promise<void> {
  const close = page.getByRole('complementary', { name: 'Projects' }).getByRole('button', { name: 'Close projects sidebar' });
  if (await close.isVisible()) await close.click();
  await expect(page.getByRole('complementary', { name: 'Projects' })).toBeHidden();
}

const controls = (page: Page) => page.getByRole('toolbar', { name: 'Canvas controls' });
const control = (page: Page, name: string) => controls(page).getByRole('button', { name, exact: true });
const nodes = (page: Page) => page.locator('.react-flow__node');
const selectedNodes = (page: Page) => page.locator('.react-flow__node.selected');
const menu = (page: Page) => page.getByRole('menu');
const cheatSheet = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });
/** A point on the empty pane, clear of the navbar, the minimap and the palette. */
const clickEmpty = (page: Page) => page.mouse.click(1000, 180);
const zoom = async (page: Page) => (await getViewport(page)).zoom;

function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.use({ actionTimeout: 15_000 });

test('control bar: layout, animated zoom and fit from buttons and keys, per-client undo states and redo clearing (AC-001–004, AC-022)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await open(page, 'E2E F10 controls');

  // AC-001/AC-002: order, separator, geometry at desktop and narrow widths, never over the palette.
  const labels = await controls(page).getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(labels).toEqual(['Zoom out', 'Fit view', 'Zoom in', 'Undo', 'Redo']);
  await expect(controls(page).getByRole('separator')).toHaveCount(1);
  for (const [width, bottom] of [
    [1280, 16],
    [700, 80],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    const bar = (await controls(page).boundingBox())!;
    expect(bar.x).toBe(16);
    expect(Math.round(800 - (bar.y + bar.height))).toBe(bottom);
    const button = (await control(page, 'Zoom in').boundingBox())!;
    expect([button.width, button.height]).toEqual([32, 32]);
    const palette = (await page.getByRole('toolbar', { name: 'Shape palette' }).boundingBox())!;
    expect(intersects(bar, palette)).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // AC-004: nothing to undo in a fresh room.
  for (const name of ['Undo', 'Redo']) {
    await expect(control(page, name)).toBeDisabled();
    await expect(control(page, name)).toHaveAttribute('aria-disabled', 'true');
    await expect(control(page, name)).toHaveCSS('opacity', '0.4');
  }

  // AC-003: the button zoom is animated (an intermediate read lies strictly between), then the keys match it.
  const [mid, end] = await page.evaluate(async () => {
    (document.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 90));
    const during = window.__rf!.getZoom();
    await new Promise((r) => setTimeout(r, 300));
    return [during, window.__rf!.getZoom()];
  });
  expect(mid).toBeGreaterThan(1);
  expect(mid).toBeLessThan(end);
  await control(page, 'Zoom out').click();
  await expect.poll(() => zoom(page)).toBeCloseTo(1, 5);
  await control(page, 'Zoom out').click();
  await expect.poll(() => zoom(page)).toBeLessThan(1);
  await setViewport(page, { x: 0, y: 0, zoom: 1 });
  await clickEmpty(page);
  for (const [key, grows] of [
    ['=', true],
    ['-', false],
    ['+', true],
  ] as const) {
    const from = await zoom(page);
    await page.keyboard.press(key);
    await page.waitForTimeout(350); // the 200 ms animation settles
    expect((await zoom(page)) > from, key).toBe(grows);
  }

  // Fit view (button and Shift+1) brings far-away nodes back into view with padding.
  await dropShape(page, 'rectangle', { x: 300, y: 300 });
  await dropShape(page, 'circle', { x: 900, y: 500 });
  const allVisible = async () => {
    const pane = (await page.locator('[data-slot="flow-canvas"]').boundingBox())!;
    const boxes = await nodes(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    return boxes.every((b) => b.left >= pane.x && b.top >= pane.y && b.right <= pane.x + pane.width && b.bottom <= pane.y + pane.height);
  };
  for (const fit of [() => control(page, 'Fit view').click(), () => page.keyboard.press('Shift+Digit1')]) {
    await setViewport(page, { x: -5000, y: -5000, zoom: 1 });
    expect(await allVisible()).toBe(false);
    await fit();
    await expect.poll(allVisible).toBe(true);
  }

  // AC-004/AC-022: undo enables redo; a new local change clears it; Ctrl+Shift+Z then does nothing; reload clears all.
  await expect(control(page, 'Undo')).toBeEnabled();
  await expect(control(page, 'Redo')).toBeDisabled();
  await control(page, 'Undo').click();
  await expect(nodes(page)).toHaveCount(1);
  await expect(control(page, 'Redo')).toBeEnabled();
  await addShape(page, 'diamond');
  await expect(control(page, 'Redo')).toBeDisabled();
  await clickEmpty(page);
  await page.keyboard.press('Control+Shift+Z');
  await page.waitForTimeout(300);
  await expect(nodes(page)).toHaveCount(2);
  await page.reload();
  await page.waitForFunction(() => window.__rf !== undefined);
  await expect(control(page, 'Undo')).toBeDisabled();
  await expect(control(page, 'Redo')).toBeDisabled();
});

test('keys never reach the canvas while typing or while a dialog is open; Delete removes the selection in one undo step (AC-006–008, AC-012, AC-020)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, 'E2E F10 keyboard');
  const x = await dropShape(page, 'rectangle', { x: 500, y: 350 });
  const y = await dropShape(page, 'rectangle', { x: 850, y: 350 });
  await page.evaluate(
    ([source, target]) =>
      window.__canvasMutations!.addEdge({
        id: 'e_01JBE00000000000000000F10A',
        source,
        target,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'canvasEdge',
        data: {},
      }),
    [x, y],
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

  // Typing in the label editor: Backspace/Delete edit text only (reference bug §2).
  await node(x).dblclick();
  const editor = page.getByRole('textbox', { name: 'Node label' });
  await expect(editor).toBeFocused();
  await page.keyboard.type('API');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  await expect(node(x)).toContainText('AP');
  await expect(nodes(page)).toHaveCount(2);

  // AC-020 + AC-007: `?` opens the cheat-sheet with focus inside; keys pressed there do nothing to the canvas.
  await node(x).click();
  await expect(node(x)).toBeFocused();
  const before = await zoom(page);
  await page.keyboard.press('?');
  await expect(cheatSheet(page)).toBeVisible();
  await expect(cheatSheet(page).getByRole('row')).toHaveCount(15); // header + 14 rows (editor)
  for (const key of ['Delete', 'Backspace', 'Control+z', '+', '?', 'Control+a']) await page.keyboard.press(key);
  await page.keyboard.press('Tab');
  await expect(cheatSheet(page)).toContainText('Keyboard shortcuts');
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(nodes(page)).toHaveCount(2);
  expect(await zoom(page)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(cheatSheet(page)).toHaveCount(0);
  await expect(node(x)).toBeFocused();
  await expect(node(x)).toHaveClass(/\bselected\b/); // Escape closed only the dialog

  // AC-012: arrows are React Flow's own nudge; Escape clears the selection.
  const x0 = await page.evaluate((id) => window.__rf!.getNode(id)!.position.x, x);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate((id) => window.__rf!.getNode(id)!.position.x, x)).toBeGreaterThan(x0);
  await page.keyboard.press('Control+a');
  await expect(selectedNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(selectedNodes(page)).toHaveCount(0);

  // AC-008 (single client): Delete removes the node and its attached edge; one undo brings both back.
  await node(x).click();
  const undoBefore = await page.evaluate(() => window.__history!.canUndo());
  expect(undoBefore).toBe(true);
  await page.keyboard.press('Delete');
  await expect(nodes(page)).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  // Liveblocks 3.24.4 re-applies the server's acknowledgement of a delete after a local undo has re-created the
  // same ids, so an undo issued before the delete is acknowledged is lost (Ruling F10-R7): let it settle first.
  await page.waitForTimeout(1_000);
  await page.keyboard.press('Control+z');
  await expect(nodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  // Nothing selected: Delete is a no-op (AC-009).
  await clickEmpty(page);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  await expect(nodes(page)).toHaveCount(2);
});

test('selection: partial-overlap box, Ctrl+click toggles, Space+drag and middle-drag pan, pane click clears (AC-015)', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'E2E F10 selection');
  const a = await dropShape(page, 'rectangle', { x: 400, y: 300 });
  const b = await dropShape(page, 'rectangle', { x: 800, y: 300 });
  await clickEmpty(page);
  // A pane click keeps focus on the last node, where Space is React Flow's select key.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // Space+left-drag on the empty pane pans instead of drawing a selection box. (Over a node, React Flow 12 drags the
  // node: EC-011's "Space+drag on a node pans" is not the library's behaviour — Ruling F10-R9.)
  const vp0 = await getViewport(page);
  await page.mouse.move(900, 550);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150); // React Flow re-renders its pan mode on the keydown; a user holds Space first
  await page.mouse.down();
  await page.mouse.move(1000, 610, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const vp1 = await getViewport(page);
  expect([vp1.x - vp0.x, vp1.y - vp0.y]).toEqual([100, 60]);
  await expect(selectedNodes(page)).toHaveCount(0);
  const boxA = (await page.locator(`.react-flow__node[data-id="${a}"]`).boundingBox())!;

  // Drag from empty pane to a point inside node A only: partial overlap selects A.
  await page.mouse.move(boxA.x - 60, boxA.y - 60);
  await page.mouse.down();
  await page.mouse.move(boxA.x + 20, boxA.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(page.locator(`.react-flow__node[data-id="${a}"]`)).toHaveClass(/\bselected\b/);

  // Ctrl+click adds B, then removes it.
  const nodeB = page.locator(`.react-flow__node[data-id="${b}"]`);
  await nodeB.click({ modifiers: ['Control'] });
  await expect(selectedNodes(page)).toHaveCount(2);
  await nodeB.click({ modifiers: ['Control'] });
  await expect(selectedNodes(page)).toHaveCount(1);

  // Middle-drag pans and leaves the selection alone.
  const vp2 = await getViewport(page);
  await page.mouse.move(1000, 600);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(1060, 640, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  expect((await getViewport(page)).x).not.toBe(vp2.x);
  await expect(selectedNodes(page)).toHaveCount(1);

  // A pane click clears the selection.
  await nodeB.click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await clickEmpty(page);
  await expect(selectedNodes(page)).toHaveCount(0);
});

test('context menu: node, edge and pane items, keyboard operation, right-drag pans without a menu, flips at the edge (AC-016–018, AC-020)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, 'E2E F10 menu');
  const x = await dropShape(page, 'rectangle', { x: 500, y: 350 });
  const y = await dropShape(page, 'rectangle', { x: 850, y: 350 });
  await page.evaluate(
    ([source, target]) =>
      window.__canvasMutations!.addEdge({
        id: 'e_01JBE00000000000000000F10B',
        source,
        target,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'canvasEdge',
        data: {},
      }),
    [x, y],
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await clickEmpty(page);
  await expect(selectedNodes(page)).toHaveCount(0);

  // Node: opens at the pointer, selects the node, Duplicate + Delete.
  const boxX = (await page.locator(`.react-flow__node[data-id="${x}"]`).boundingBox())!;
  const at = { x: boxX.x + 30, y: boxX.y + 20 };
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitem')).toHaveText(['DuplicateCtrl+D', 'DeleteDel']);
  const menuBox = (await menu(page).boundingBox())!;
  expect(Math.abs(menuBox.x - at.x)).toBeLessThanOrEqual(8);
  expect(Math.abs(menuBox.y - at.y)).toBeLessThanOrEqual(8);
  await expect(page.locator(`.react-flow__node[data-id="${x}"]`)).toHaveClass(/\bselected\b/);
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('menuitem', { name: /Duplicate/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('menuitem', { name: /Delete/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveCount(0);
  await expect(nodes(page)).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.waitForTimeout(1_000); // let the delete be acknowledged before undoing (Ruling F10-R7)
  await page.keyboard.press('Control+z');
  await expect(nodes(page)).toHaveCount(2);

  // Edge: Delete only.
  const edge = page.locator('.react-flow__edge path.react-flow__edge-path');
  const mid = await edge.evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(mid.x, mid.y, { button: 'right' });
  await expect(menu(page).getByRole('menuitem')).toHaveText(['DeleteDel']);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);

  // Pane: Select all / Fit view / Keyboard shortcuts; a pane click closes it.
  await page.mouse.click(1100, 200, { button: 'right' });
  await expect(menu(page).getByRole('menuitem')).toHaveText(['Select allCtrl+A', 'Fit viewShift+1', 'Keyboard shortcuts?']);
  await clickEmpty(page);
  await expect(menu(page)).toHaveCount(0);
  await page.mouse.click(1100, 200, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: /Select all/ }).click();
  await expect(selectedNodes(page)).toHaveCount(2);
  await page.mouse.click(1100, 200, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: /Keyboard shortcuts/ }).click();
  await expect(cheatSheet(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cheatSheet(page)).toHaveCount(0);

  // AC-017: a right-button drag pans and opens nothing; a still right-click opens the menu.
  const vp0 = await getViewport(page);
  await page.mouse.move(300, 300);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(360, 320, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(200);
  await expect(menu(page)).toHaveCount(0);
  expect((await getViewport(page)).x).not.toBe(vp0.x);

  // AC-018: opened at the right and bottom edges (clear of the minimap and the attribution), the menu flips/shifts to
  // stay inside the viewport.
  for (const at of [
    { x: 1276, y: 600 },
    { x: 1000, y: 796 },
  ]) {
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    const box = (await menu(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
  }
});
