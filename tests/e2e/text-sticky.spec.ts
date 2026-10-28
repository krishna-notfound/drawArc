import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import { addShape, dropShape, getViewport, openCanvas, pressCanvasKey } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F22 text and sticky notes, single editor (user A owns the project): creation by key / palette / drop (AC-007,
// AC-008), side resize of text and the 75 px sticky minimum (AC-011).

let projectId: string;

test.beforeEach(async () => {
  projectId = await createProjectFor(userA().email, 'E2E F22 text and sticky');
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
    return {
      x: n.position.x,
      y: n.position.y,
      width: n.width!,
      height: n.height!,
      label: n.data.label,
      color: n.data.color,
      autoWidth: 'autoWidth' in n.data ? n.data.autoWidth : undefined,
    };
  }, id);

/** The flow-space point under a client point. */
const flowPoint = (page: Page, client: { x: number; y: number }) =>
  page.evaluate((c) => window.__rf!.screenToFlowPosition(c), client);

/** `pressCanvasKey` clicks here first, so T / N insert under this client point. */
const KEY_POINT = { x: 1000, y: 180 };

const selectedId = async (page: Page) => {
  const selected = page.locator('.react-flow__node.selected');
  await expect(selected).toHaveCount(1);
  return (await selected.getAttribute('data-id'))!;
};

/** Drags the node's resize control (e.g. "handle.bottom.right", "line.right") by (dx, dy) screen px. */
async function dragHandle(page: Page, id: string, control: string, dx: number, dy: number) {
  const box = (await node(page, id).locator(`.react-flow__resize-control.${control}`).boundingBox())!;
  // An edge line is grabbed a quarter along it, away from the midpoint.
  const at = control.startsWith('line.') ? 0.25 : 0.5;
  const x = box.x + box.width * at;
  const y = box.y + box.height * at;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test('T and N create at the pointer; keys are ignored while editing or with Ctrl (AC-008, AC-007)', async ({ page }) => {
  test.setTimeout(120_000);
  await openCanvas(page, projectId);

  // T: a selected text node centred on the pointer (registry insert, like R/D/O) with its editor focused.
  await pressCanvasKey(page, 't');
  const textId = await selectedId(page);
  expect(textId).toMatch(/^text_/);
  await expect(editor(page)).toBeFocused();
  const created = await stored(page, textId);
  const centre = await flowPoint(page, KEY_POINT);
  expect(Math.abs(created.x + created.width / 2 - centre.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(created.y + created.height / 2 - centre.y)).toBeLessThanOrEqual(1);

  await page.keyboard.type('Hello');
  await page.keyboard.press('Enter');
  await expect.poll(() => stored(page, textId).then((s) => s.label)).toBe('Hello');
  const text = await stored(page, textId);
  expect(text.autoWidth).toBe(true);
  expect(text.width).toBeGreaterThanOrEqual(24);
  const { zoom } = await getViewport(page);
  const box = (await node(page, textId).boundingBox())!;
  expect(Math.abs(box.width / zoom - text.width)).toBeLessThanOrEqual(1);

  // N: a selected 250 x 250 orange sticky.
  await pressCanvasKey(page, 'n');
  const stickyId = await selectedId(page);
  expect(stickyId).toMatch(/^sticky_/);
  expect(await stored(page, stickyId)).toMatchObject({ width: 250, height: 250, color: 'orange' });

  // Keys typed into an open editor, or with Ctrl, create nothing.
  await node(page, stickyId).dblclick({ position: { x: 30, y: 30 } });
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('t');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press('Control+t');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  // Palette click (centre) and drop (at the pointer).
  await addShape(page, 'sticky');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  const dropAt = { x: 700, y: 400 };
  const dropped = await dropShape(page, 'sticky', dropAt);
  const droppedBox = await stored(page, dropped);
  const dropFlow = await flowPoint(page, dropAt);
  expect(Math.abs(droppedBox.x + droppedBox.width / 2 - dropFlow.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(droppedBox.y + droppedBox.height / 2 - dropFlow.y)).toBeLessThanOrEqual(1);
});

test('pasting plain text creates a text node at the pointer; an input swallows it (F10 AC-033, FR-018)', async ({ page }) => {
  test.setTimeout(120_000);
  await openCanvas(page, projectId);
  await page.mouse.click(KEY_POINT.x, KEY_POINT.y);
  const pasteText = (text: string) =>
    page.evaluate((t) => {
      const data = new DataTransfer();
      data.setData('text/plain', t);
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }, text);

  expect(await pasteText('  Plain words from elsewhere  ')).toBe(true);
  const id = await selectedId(page);
  expect(id).toMatch(/^text_/);
  const pasted = await stored(page, id);
  expect(pasted).toMatchObject({ label: 'Plain words from elsewhere', autoWidth: true });
  const at = await flowPoint(page, KEY_POINT);
  // Pasted content lands with its top-left at the pointer (F10 FR-017, like pasted shapes).
  expect(Math.abs(pasted.x - at.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(pasted.y - at.y)).toBeLessThanOrEqual(1);
  // A non-empty label skips the editor auto-open (F22 FR-007).
  await expect(editor(page)).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('side resize makes text fixed-width and wraps; a sticky never goes below 75 x 75 (AC-011)', async ({ page }) => {
  test.setTimeout(120_000);
  await openCanvas(page, projectId);
  const { zoom } = await getViewport(page);

  // Left of centre: the unwrapped text grows rightwards and its right edge must stay inside the viewport.
  await pressCanvasKey(page, 't', { x: 400, y: 300 });
  const textId = await selectedId(page);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('a long sentence that will wrap when narrowed');
  await page.keyboard.press('Enter');
  await expect.poll(() => stored(page, textId).then((s) => s.label)).toBe('a long sentence that will wrap when narrowed');
  const before = await stored(page, textId);
  expect(before.width).toBeGreaterThan(150);

  await dragHandle(page, textId, 'line.right', (120 - before.width) * zoom, 0);
  await expect.poll(() => stored(page, textId).then((s) => s.autoWidth)).toBe(false);
  const after = await stored(page, textId);
  expect(after.width).toBe(120);
  expect(after.height).toBeGreaterThan(before.height);
  const whiteSpace = await node(page, textId)
    .locator('[data-slot="node-label"]')
    .evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(whiteSpace).toBe('pre-wrap');

  await pressCanvasKey(page, 'n');
  const stickyId = await selectedId(page);
  await dragHandle(page, stickyId, 'handle.bottom.right', -300, -300);
  await expect.poll(() => stored(page, stickyId).then((s) => [s.width, s.height])).toEqual([75, 75]);
});
