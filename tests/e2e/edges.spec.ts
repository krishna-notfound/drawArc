import { expect, type Page, test } from '@playwright/test';

import { HANDLE_IDS } from '@/types/canvas';

import { userA } from './clerk-users';
import { dropShape, openCanvas, paletteButton } from './helpers/canvas';
import {
  centre,
  connect,
  deleteEdge,
  dragFromHandle,
  dragTargetEnd,
  edgeGroup,
  edges,
  expectEdgeCount,
  handle,
  onlyEdge,
  pathMidpoint,
  pathStyle,
} from './helpers/edges';
import { deleteRoom } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F09 single-user behaviour in a real browser (React Flow needs measured nodes, so edges are verified here).

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

const ID = /^e_[0-9A-HJKMNP-TV-Z]{26}$/;
const STROKE = 'rgb(248, 250, 252)';
const canUndo = (page: Page) => page.evaluate(() => window.__history!.canUndo());
const undo = (page: Page) => page.evaluate(() => window.__history!.undo());

async function open(page: Page, name: string): Promise<void> {
  projectId = await createProjectFor(userA().email, name);
  await openCanvas(page, projectId);
}

test('all 16 handle pairs connect; invalid releases create nothing; the edge renders as specified (AC-002–005, 008, 012, 014, 017)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await open(page, 'E2E F09 edges');
  const x = await dropShape(page, 'rectangle', { x: 500, y: 300 });
  const y = await dropShape(page, 'rectangle', { x: 1000, y: 300 });

  // AC-008 / EC-005 / EC-006: released over the pane, over the palette, and over X's own handle.
  await dragFromHandle(page, x, 'right', { x: 750, y: 450 });
  await dragFromHandle(page, x, 'right', await centre(paletteButton(page, 'circle')));
  await dragFromHandle(page, x, 'right', await centre(handle(page, x, 'bottom')));
  await page.waitForTimeout(500);
  expect(await edges(page)).toEqual([]);

  // AC-005 (reference bug §3): every source handle × every target handle creates exactly one schema-v1 edge.
  for (const sourceHandle of HANDLE_IDS) {
    for (const targetHandle of HANDLE_IDS) {
      await connect(page, [x, sourceHandle], [y, targetHandle]);
      const edge = await onlyEdge(page);
      expect(edge, `${sourceHandle} → ${targetHandle}`).toEqual({
        id: expect.stringMatching(ID),
        source: x,
        target: y,
        sourceHandle,
        targetHandle,
        type: 'canvasEdge',
        data: {},
      });
      await deleteEdge(page, edge.id);
      await expectEdgeCount(page, 0);
    }
  }

  await connect(page, [x, 'right'], [y, 'left']);
  const { id } = await onlyEdge(page);
  // A duplicate of the same handle pair is refused (AC-007 in the browser).
  await connect(page, [x, 'right'], [y, 'left']);
  await page.waitForTimeout(500);
  await expectEdgeCount(page, 1);

  // AC-002: closed arrowhead in the edge colour at the target end; never persisted on the edge.
  const group = edgeGroup(page, id);
  const markerRef = await group.locator('path.react-flow__edge-path').getAttribute('marker-end');
  const markerId = /url\('?#([^')]+)'?\)/.exec(markerRef!)![1];
  const markerFill = await page.evaluate(
    (mid) => getComputedStyle(document.getElementById(mid)!.querySelector('polyline')!).fill,
    markerId,
  );
  expect(markerFill).toBe(STROKE);
  expect(await page.evaluate((edgeId) => 'markerEnd' in window.__rf!.getEdge(edgeId)!, id)).toBe(false);

  // AC-003 / AC-004: rest, hover, selected, deselected.
  expect(await pathStyle(page, id)).toEqual({ stroke: STROKE, opacity: '0.6', width: '1.5px', cap: 'round' });
  const interactionWidth = await group
    .locator('path.react-flow__edge-interaction')
    .evaluate((el) => getComputedStyle(el).strokeWidth);
  expect(interactionWidth).toBe('20px');
  const mid = await pathMidpoint(page, id);
  await page.mouse.move(mid.x, mid.y);
  await expect.poll(async () => (await pathStyle(page, id)).opacity).toBe('1');
  await page.mouse.click(mid.x, mid.y);
  await expect(group).toHaveClass(/selected/);
  await page.mouse.move(750, 450);
  expect(await pathStyle(page, id)).toMatchObject({ opacity: '1', width: '2px' });
  // AC-014: a selected unlabelled edge shows the faint hint.
  await expect(page.getByText('Double-click to label')).toBeVisible();
  await page.mouse.click(750, 450);
  await expect(group).not.toHaveClass(/selected/);
  expect(await pathStyle(page, id)).toMatchObject({ opacity: '0.6', width: '1.5px' });
  await expect(page.getByText('Double-click to label')).toHaveCount(0);

  // AC-012 / AC-014 / AC-017: inline label, pill badge at the midpoint, readable focusable edge.
  await page.mouse.dblclick(mid.x, mid.y);
  const input = page.getByRole('textbox', { name: 'Edge label' });
  await expect(input).toBeFocused();
  await input.fill('HTTPS');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  const badge = page.locator(`[data-edge-label="${id}"]`).getByText('HTTPS');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/rounded-xl/);
  const badgeCentre = await centre(badge);
  expect(Math.abs(badgeCentre.x - mid.x)).toBeLessThan(2);
  expect(Math.abs(badgeCentre.y - mid.y)).toBeLessThan(2);
  expect((await onlyEdge(page)).data).toEqual({ label: 'HTTPS' });
  await expect(group).toHaveAttribute('aria-label', 'edge from rectangle to rectangle, labelled HTTPS');
  await expect(group).toHaveAttribute('tabindex', '0');
});

test('create, reconnect, label and delete are one undo entry each; an end dropped on empty space deletes (AC-011, AC-019)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, 'E2E F09 undo');
  const x = await dropShape(page, 'rectangle', { x: 500, y: 300 });
  const y = await dropShape(page, 'rectangle', { x: 1000, y: 300 });
  const z = await dropShape(page, 'rectangle', { x: 750, y: 560 });
  expect(await canUndo(page)).toBe(true); // the three drops

  await connect(page, [x, 'right'], [y, 'left']);
  const created = await onlyEdge(page);

  await dragTargetEnd(page, created.id, await centre(handle(page, z, 'top')));
  await expect.poll(async () => (await onlyEdge(page)).target).toBe(z);
  const reconnected = await onlyEdge(page);
  expect(reconnected).toEqual({ ...created, target: z, targetHandle: 'top' });

  // Dropping the end back on the same handle changes nothing (EC-003).
  await dragTargetEnd(page, created.id, await centre(handle(page, z, 'top')));
  await page.waitForTimeout(300);
  expect(await onlyEdge(page)).toEqual(reconnected);

  const mid = await pathMidpoint(page, created.id);
  await page.mouse.dblclick(mid.x, mid.y);
  await page.getByRole('textbox', { name: 'Edge label' }).fill('events');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await onlyEdge(page)).data).toEqual({ label: 'events' });

  await deleteEdge(page, created.id);
  await expectEdgeCount(page, 0);

  // Four undos, each reverting exactly one action; the nodes stay.
  await undo(page);
  await expect.poll(async () => await edges(page)).toEqual([{ ...reconnected, data: { label: 'events' } }]);
  await undo(page);
  await expect.poll(async () => await edges(page)).toEqual([reconnected]);
  await undo(page);
  await expect.poll(async () => await edges(page)).toEqual([created]);
  await undo(page);
  await expectEdgeCount(page, 0);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  // D-09b: releasing a dragged end on empty space deletes the edge.
  await connect(page, [x, 'bottom'], [z, 'left']);
  const dropped = await onlyEdge(page);
  await dragTargetEnd(page, dropped.id, { x: 1000, y: 560 });
  await expectEdgeCount(page, 0);
});
