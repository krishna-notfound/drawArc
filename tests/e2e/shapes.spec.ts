import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import {
  addShape,
  centreOf,
  dropShape,
  getViewport,
  openCanvas,
  paletteButton,
  setViewport,
  startShapeDrag,
} from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F07 shapes and node creation, single editor (user A owns the project). Each test gets its own project and room.

let projectId: string;

test.beforeEach(async () => {
  projectId = await createProjectFor(userA().email, 'E2E F07 shapes');
});

test.afterEach(async () => {
  await deleteProject(projectId);
  await deleteRoom(projectId);
});

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

function expectWithin1px(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(Math.abs(actual.x - expected.x), `x ${actual.x} vs ${expected.x}`).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.y - expected.y), `y ${actual.y} vs ${expected.y}`).toBeLessThanOrEqual(1);
}

test('a dropped shape is centred under the cursor at any pan/zoom and the viewport never moves (AC-002, AC-004, AC-008, AC-011, AC-013, AC-021)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCanvas(page, projectId);

  // AC-002: bottom-centre pill, 16 px above the viewport bottom, six buttons in NODE_SHAPES order.
  const palette = page.getByRole('toolbar', { name: 'Shape palette' });
  const box = (await palette.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThanOrEqual(2);
  expect(Math.round(800 - (box.y + box.height))).toBe(16);
  const labels = await palette.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(labels).toEqual([
    'Add rectangle',
    'Add diamond',
    'Add circle',
    'Add pill',
    'Add cylinder',
    'Add hexagon',
    'Add text', // F22
    'Add sticky note',
  ]);

  // AC-004 / AC-021: mid-drag, the ghost is centred on the pointer at the current zoom and is transparent to
  // elementFromPoint, which sees the flow pane under it (nothing intercepts the gesture).
  const viewport = { x: 123, y: -45, zoom: 1.3 };
  await setViewport(page, viewport);
  await startShapeDrag(page, 'hexagon', { x: 700, y: 400 });
  const ghost = page.getByTestId('shape-drag-ghost');
  await expect(ghost).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => centreOf(page, '[data-testid="shape-drag-ghost"]')).toEqual({ x: 700, y: 400 });
  const ghostBox = (await ghost.boundingBox())!;
  expect(ghostBox.width).toBeCloseTo(160 * 1.3, 1);
  expect(ghostBox.height).toBeCloseTo(110 * 1.3, 1);
  const probe = await page.evaluate(() => {
    const el = document.elementFromPoint(700, 400);
    return {
      pointerEvents: getComputedStyle(document.querySelector('[data-testid="shape-drag-ghost"]')!).pointerEvents,
      inPane: Boolean(el?.closest('.react-flow__pane')),
      isGhost: Boolean(el?.closest('[data-testid="shape-drag-ghost"]')),
    };
  });
  expect(probe).toEqual({ pointerEvents: 'none', inPane: true, isGhost: false });
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);

  // AC-011 (reference bug §5): the first drop on an empty canvas does not fit or move the viewport.
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  const first = (await page.locator('.react-flow__node').getAttribute('data-id'))!;
  await page.waitForTimeout(500);
  expect(await getViewport(page)).toEqual(viewport);
  expectWithin1px(await centreOf(page, `.react-flow__node[data-id="${first}"]`), { x: 700, y: 400 });

  // AC-013: the new node is selected and focused.
  await expect(node(page, first)).toHaveClass(/\bselected\b/);
  expect(await node(page, first).evaluate((el) => el === document.activeElement)).toBe(true);

  // A second drop: still no viewport change, and the selection moves to the newer node only.
  const second = await dropShape(page, 'rectangle', { x: 950, y: 250 });
  await page.waitForTimeout(500);
  expect(await getViewport(page)).toEqual(viewport);
  await expect(node(page, first)).not.toHaveClass(/\bselected\b/);
  expect(await node(page, second).evaluate((el) => el === document.activeElement)).toBe(true);

  // AC-008 (reference bug §4): centred under the cursor after a (-640, 480) pan at zoom 0.5 and 2.
  for (const zoom of [0.5, 2]) {
    await setViewport(page, { x: -640, y: 480, zoom });
    const id = await dropShape(page, 'rectangle', { x: 500, y: 400 });
    expectWithin1px(await centreOf(page, `.react-flow__node[data-id="${id}"]`), { x: 500, y: 400 });
    expect(await getViewport(page)).toEqual({ x: -640, y: 480, zoom });
  }
});

test('click, Enter and Space place a shape at the canvas centre, selected and focused (AC-012, AC-013)', async ({ page }) => {
  await openCanvas(page, projectId);
  const centre = await centreOf(page, '.react-flow');

  await paletteButton(page, 'pill').focus();
  await page.keyboard.press('Enter');
  const pill = page.locator('.react-flow__node.selected');
  await expect(pill).toHaveCount(1);
  expectWithin1px(await centreOf(page, '.react-flow__node.selected'), centre);
  expect(await pill.evaluate((el) => el === document.activeElement)).toBe(true);

  await paletteButton(page, 'pill').focus();
  await page.keyboard.press(' ');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  const circle = await addShape(page, 'circle');
  expectWithin1px(await centreOf(page, `.react-flow__node[data-id="${circle}"]`), centre);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  expect(await node(page, circle).evaluate((el) => el === document.activeElement)).toBe(true);
});

test('every one of the four handles starts a connection; handles show only on hover (AC-016, AC-017 — reference bug §3)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCanvas(page, projectId);
  const source = await dropShape(page, 'rectangle', { x: 600, y: 300 });
  const target = await dropShape(page, 'diamond', { x: 950, y: 560 });

  const handle = (nodeId: string, id: string) => `.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${id}"]`;
  // Four handles, positioned on each side, measurable (never display:none) and invisible at rest.
  const handles = node(page, source).locator('.react-flow__handle');
  await expect(handles).toHaveCount(4);
  await page.mouse.move(400, 700); // away from every node
  const rest = await handles.evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return [el.getAttribute('data-handleid'), el.getAttribute('data-handlepos'), s.display, s.visibility, s.opacity];
    }),
  );
  expect(rest.map(([id, pos, display, visibility]) => [id, pos, display === 'none', visibility])).toEqual([
    ['top', 'top', false, 'visible'],
    ['right', 'right', false, 'visible'],
    ['bottom', 'bottom', false, 'visible'],
    ['left', 'left', false, 'visible'],
  ]);
  await expect.poll(() => handles.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).toEqual(['0', '0', '0', '0']);
  await node(page, source).hover();
  await expect.poll(() => handles.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).toEqual(['1', '1', '1', '1']);

  for (const start of ['top', 'right', 'bottom', 'left']) {
    const from = await centreOf(page, handle(source, start));
    const to = await centreOf(page, handle(target, 'left'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }

  await expect
    .poll(() =>
      page.evaluate(() => window.__rf!.getEdges().map((e) => `${e.source}:${e.sourceHandle}->${e.target}:${e.targetHandle}`).sort()),
    )
    .toEqual(['bottom', 'left', 'right', 'top'].map((h) => `${source}:${h}->${target}:left`));
});
