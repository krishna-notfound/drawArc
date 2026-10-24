import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import { addShape, dropShape, getViewport, openCanvas } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F08 node editing, single editor (user A owns the project): label editor semantics and key isolation, resize
// maths / minimum / circle aspect / undo granularity, and the selection colour toolbar.

let projectId: string;

test.beforeEach(async () => {
  projectId = await createProjectFor(userA().email, 'E2E F08 node editing');
});

test.afterEach(async () => {
  await deleteProject(projectId);
  await deleteRoom(projectId);
});

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const editor = (page: Page) => page.getByRole('textbox', { name: 'Node label' });

const stored = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const n = window.__rf!.getNode(nodeId)!;
    return { x: n.position.x, y: n.position.y, width: n.width, height: n.height, label: n.data.label, color: n.data.color };
  }, id);

/** Drags the node's resize control (e.g. "handle.bottom.right", "line.right") by (dx, dy) screen px. */
async function dragHandle(page: Page, id: string, control: string, dx: number, dy: number) {
  const box = (await node(page, id).locator(`.react-flow__resize-control.${control}`).boundingBox())!;
  // An edge line is grabbed a quarter along it: its midpoint is under the connection handle.
  const at = control.startsWith('line.') ? 0.25 : 0.5;
  const x = box.x + box.width * at;
  const y = box.y + box.height * at;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test('label editor: Enter / Shift+Enter / Escape / blur semantics and no key reaches the canvas (AC-010, AC-011, AC-012)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCanvas(page, projectId);
  const id = await addShape(page, 'rectangle');
  await expect(node(page, id)).toContainText('Double-click to label');
  const before = await stored(page, id);
  const viewport = await getViewport(page);

  // Key isolation (AC-012): record every keydown that reaches the window or the pane while typing.
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] };
    w.__keys = [];
    const record = (e: Event) => w.__keys.push((e as KeyboardEvent).key);
    window.addEventListener('keydown', record);
    document.querySelector('.react-flow__pane')!.addEventListener('keydown', record);
  });
  await node(page, id).dblclick();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('abc');
  for (const key of ['Backspace', 'Delete', 'ArrowLeft', '+', '-', '?', 'Control+z', 'Control+a', 'Backspace']) {
    await page.keyboard.press(key);
  }
  const editorBox = (await editor(page).boundingBox())!;
  await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height / 2);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys)).toEqual([]);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  expect(await getViewport(page)).toEqual(viewport);
  expect(await stored(page, id)).toEqual(before);

  // Shift+Enter is a newline; Enter commits the trimmed text once and returns focus to the node.
  await page.keyboard.type('  Gateway');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('API  ');
  await page.keyboard.press('Enter');
  await expect(editor(page)).toHaveCount(0);
  await expect(node(page, id)).toBeFocused();
  await expect.poll(async () => (await stored(page, id)).label).toBe('Gateway\nAPI');
  await expect(node(page, id).locator('[data-slot="node-label"]')).toHaveText('Gateway\nAPI');

  // Escape discards the draft.
  await page.keyboard.press('Enter'); // Enter on the focused node opens the editor (AC-009)
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('discarded');
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveCount(0);
  await expect(node(page, id)).toBeFocused();
  expect((await stored(page, id)).label).toBe('Gateway\nAPI');

  // Blur (clicking the empty canvas) commits; the editor caps input at 200 characters.
  await node(page, id).dblclick();
  await editor(page).fill('x'.repeat(250));
  await expect(editor(page)).toHaveValue('x'.repeat(200));
  await page.mouse.click(1000, 150);
  await expect(editor(page)).toHaveCount(0);
  await expect.poll(async () => (await stored(page, id)).label).toBe('x'.repeat(200));
});

test('resize persists width/height, clamps at 48 × 32, keeps the circle square, one undo step per gesture (AC-003, AC-005, AC-006)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCanvas(page, projectId);
  const rect = await dropShape(page, 'rectangle', { x: 500, y: 300 });
  const start = await stored(page, rect);
  expect(start).toMatchObject({ width: 180, height: 80 });
  // Selected: React Flow's 4 corner handles + 4 edge lines (AC-001).
  await expect(node(page, rect).locator('.react-flow__resize-control.handle')).toHaveCount(4);
  await expect(node(page, rect).locator('.react-flow__resize-control.line')).toHaveCount(4);

  await dragHandle(page, rect, 'handle.bottom.right', 60, 40);
  await expect.poll(() => stored(page, rect)).toMatchObject({ width: 240, height: 120, x: start.x, y: start.y });
  await expect(node(page, rect)).toHaveCSS('width', '240px');

  await dragHandle(page, rect, 'handle.top.left', -20, -10);
  await expect.poll(() => stored(page, rect)).toMatchObject({ width: 260, height: 130, x: start.x - 20, y: start.y - 10 });

  await dragHandle(page, rect, 'handle.bottom.right', -400, -400);
  await expect.poll(() => stored(page, rect)).toMatchObject({ width: 48, height: 32 });

  // Circle: aspect locked (AC-005); then resize + drag are exactly two undo steps (AC-006).
  const circle = await dropShape(page, 'circle', { x: 900, y: 500 });
  await expect(node(page, rect).locator('.react-flow__resize-control')).toHaveCount(0);
  const c0 = await stored(page, circle);
  await dragHandle(page, circle, 'line.right', 50, 0);
  await expect.poll(() => stored(page, circle)).toMatchObject({ width: 146, height: 146 });
  const box = (await node(page, circle).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  // React Flow's drag threshold swallows the first step, so the node moves a little under 100 px.
  await expect.poll(async () => (await stored(page, circle)).x).toBeGreaterThan(c0.x + 80);

  await page.evaluate(() => window.__history!.undo());
  await expect.poll(() => stored(page, circle)).toMatchObject({ x: c0.x, y: c0.y, width: 146, height: 146 });
  await page.evaluate(() => window.__history!.undo());
  await expect.poll(() => stored(page, circle)).toMatchObject({ x: c0.x, y: c0.y, width: 96, height: 96 });
});

test('the colour toolbar recolours the whole selection in one undo step and never drags (AC-017, AC-018)', async ({ page }) => {
  test.setTimeout(90_000);
  await openCanvas(page, projectId);
  const toolbar = page.getByRole('radiogroup', { name: 'Node colour' });
  const ids: string[] = [];
  for (const [i, x] of [500, 750, 1000].entries()) {
    ids.push(await dropShape(page, 'rectangle', { x, y: 350 }));
    if (i > 0) await toolbar.getByRole('radio', { name: 'Colour: blue' }).click();
  }
  await expect.poll(() => Promise.all(ids.map(async (id) => (await stored(page, id)).color))).toEqual(['neutral', 'blue', 'blue']);

  await node(page, ids[0]!).click();
  for (const id of ids.slice(1)) await node(page, id).click({ modifiers: ['Control'] });
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
  // Mixed selection: nothing checked.
  await expect(toolbar.locator('[aria-checked="true"]')).toHaveCount(0);

  // Pressing on the toolbar's padding and moving does not drag the nodes or pan (AC-018 drag half).
  const positions = await Promise.all(ids.map((id) => stored(page, id)));
  const tb = (await toolbar.boundingBox())!;
  await page.mouse.move(tb.x + 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + 32, tb.y + tb.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  expect(await Promise.all(ids.map((id) => stored(page, id)))).toEqual(positions);

  await toolbar.getByRole('radio', { name: 'Colour: green' }).click();
  await expect.poll(() => Promise.all(ids.map(async (id) => (await stored(page, id)).color))).toEqual(['green', 'green', 'green']);
  await expect(toolbar.getByRole('radio', { name: 'Colour: green' })).toHaveAttribute('aria-checked', 'true');

  await page.evaluate(() => window.__history!.undo());
  await expect.poll(() => Promise.all(ids.map(async (id) => (await stored(page, id)).color))).toEqual(['neutral', 'blue', 'blue']);
});
