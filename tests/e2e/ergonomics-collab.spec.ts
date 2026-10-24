import { expect as baseExpect, type Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { dropShape, getViewport, openCanvas } from './helpers/canvas';
import { pathMidpoint } from './helpers/edges';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F10 across two real Clerk users in one Liveblocks room: keyboard Delete and Duplicate travel the collaborative
// path in one undo step, undo is per client and does not rebase (D-013), and a viewer's mutating keys do nothing.

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

const nodeIds = (page: Page) => page.evaluate(() => window.__rf!.getNodes().map((n) => n.id).sort());
const edgeIds = (page: Page) => page.evaluate(() => window.__rf!.getEdges().map((e) => e.id).sort());
const position = (page: Page, id: string) => page.evaluate((nodeId) => window.__rf!.getNode(nodeId)?.position ?? null, id);
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const menu = (page: Page) => page.getByRole('menu');
const clickEmpty = (page: Page) => page.mouse.click(1000, 180);

/** Guard: the project sidebar floats over the canvas's left edge when open (closed by default in the workspace). */
async function closeProjectSidebar(page: Page): Promise<void> {
  const close = page.getByRole('complementary', { name: 'Projects' }).getByRole('button', { name: 'Close projects sidebar' });
  if (await close.isVisible()) await close.click();
  await baseExpect(page.getByRole('complementary', { name: 'Projects' })).toBeHidden();
}

function addEdge(page: Page, id: string, source: string, target: string): Promise<void> {
  return page.evaluate(
    ([edgeId, s, t]) =>
      window.__canvasMutations!.addEdge({ id: edgeId, source: s, target: t, sourceHandle: 'right', targetHandle: 'left', type: 'canvasEdge', data: {} }),
    [id, source, target],
  );
}

async function sameOnBoth(a: Page, b: Page, nodes: string[], edges: string[], timeout = 1_500): Promise<void> {
  for (const page of [a, b]) {
    await expect.poll(() => nodeIds(page), { timeout }).toEqual([...nodes].sort());
    await expect.poll(() => edgeIds(page), { timeout }).toEqual([...edges].sort());
  }
}

/** Liveblocks 3.24.4 loses an undo issued before the server acknowledged the delete it reverts (Ruling F10-R7). */
const settle = (page: Page) => page.waitForTimeout(1_000);

test('Delete, Backspace and Ctrl+D go through the collaborative path; one undo reverts each (AC-008, AC-014)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F10 collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  await closeProjectSidebar(a);

  const x = await dropShape(a, 'rectangle', { x: 450, y: 300 });
  const y = await dropShape(a, 'rectangle', { x: 750, y: 300 });
  const z = await dropShape(a, 'rectangle', { x: 1050, y: 300 });
  const F = 'e_01JBE00000000000000000F10F'; // X → Y, attached to X
  const E = 'e_01JBE00000000000000000F10E'; // Y → Z
  await addEdge(a, F, x, y);
  await addEdge(a, E, y, z);
  await sameOnBoth(a, b, [x, y, z], [E, F], 5_000);

  // AC-008: X and E selected, F unselected; Delete removes X, E and (cascade) F on both clients, Y and Z stay.
  await node(a, x).click();
  const mid = await pathMidpoint(a, E);
  await a.keyboard.down('Control');
  await a.mouse.click(mid.x, mid.y);
  await a.keyboard.up('Control');
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(a.locator(`.react-flow__edge.selected[data-id="${E}"]`)).toHaveCount(1);
  const started = Date.now();
  await a.keyboard.press('Delete');
  await sameOnBoth(a, b, [y, z], []);
  test.info().annotations.push({ type: 'delete-sync-ms', description: String(Date.now() - started) }); // NFR-003, TC-022
  await settle(a);
  await a.keyboard.press('Control+z');
  await sameOnBoth(a, b, [x, y, z], [E, F]);

  // Same with Backspace (only X selected): X and F go, E stays.
  await node(a, x).click();
  await a.keyboard.press('Backspace');
  await sameOnBoth(a, b, [y, z], [E]);
  await settle(a);
  await a.keyboard.press('Control+z');
  await sameOnBoth(a, b, [x, y, z], [E, F]);

  // AC-014: X and Y selected → Ctrl+D copies both and F (both ends selected), not E; the copies are A's selection.
  await node(a, x).click();
  await node(a, y).click({ modifiers: ['Control'] });
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(2);
  await a.keyboard.press('Control+d');
  for (const page of [a, b]) {
    await expect.poll(() => nodeIds(page), { timeout: 1_500 }).toHaveLength(5);
    await expect.poll(() => edgeIds(page), { timeout: 1_500 }).toHaveLength(3);
  }
  const selected = await a.evaluate(() => ({
    nodes: window.__rf!.getNodes().filter((n) => n.selected),
    edges: window.__rf!.getEdges().filter((e) => e.selected),
  }));
  expect(selected.nodes.map((n) => n.id)).not.toContain(x);
  expect(selected.nodes.map((n) => n.id)).not.toContain(y);
  expect(selected.nodes).toHaveLength(2);
  expect(selected.edges).toHaveLength(1);
  const copyIds = new Set(selected.nodes.map((n) => n.id));
  expect(copyIds.has(selected.edges[0].source) && copyIds.has(selected.edges[0].target)).toBe(true);
  const px = (await position(a, x))!;
  expect(selected.nodes.some((n) => n.position.x === px.x + 20 && n.position.y === px.y + 20)).toBe(true);
  await a.keyboard.press('Control+z');
  await sameOnBoth(a, b, [x, y, z], [E, F]);

  // Nothing selected: Ctrl+D changes nothing.
  await clickEmpty(a);
  await a.keyboard.press('Control+d');
  await a.waitForTimeout(500);
  await sameOnBoth(a, b, [x, y, z], [E, F]);
});

test('undo is per client and does not rebase: A undoes only A’s move, over B’s newer one (AC-023, D-013)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F10 undo');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  await closeProjectSidebar(a);
  await closeProjectSidebar(b);
  const errors: string[] = [];
  for (const page of [a, b]) page.on('pageerror', (err) => errors.push(err.message));

  const x = await dropShape(a, 'rectangle', { x: 500, y: 350 });
  await expect.poll(() => nodeIds(b), { timeout: 5_000 }).toEqual([x]);
  const y = await dropShape(b, 'circle', { x: 900, y: 550 }); // B's own change
  await expect.poll(() => nodeIds(a), { timeout: 5_000 }).toEqual([x, y].sort());

  const drag = async (page: Page, dx: number, dy: number) => {
    const box = (await node(page, x).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 10 });
    await page.mouse.up();
  };
  const p0 = (await position(a, x))!;
  await drag(a, 120, 0); // A: P0 → P1
  const p1 = (await position(a, x))!;
  expect(p1).not.toEqual(p0);
  await expect.poll(() => position(b, x), { timeout: 2_000 }).toEqual(p1);
  await drag(b, 0, 100); // B: P1 → P2 (newer)
  const p2 = (await position(b, x))!;
  await expect.poll(() => position(a, x), { timeout: 2_000 }).toEqual(p2);
  const bCanUndo = await b.evaluate(() => window.__history!.canUndo());
  expect(bCanUndo).toBe(true);

  // A's undo applies A's inverse without rebasing: X returns to P0 on both, overwriting B's newer P2; B's node Y and
  // B's history are untouched.
  await clickEmpty(a);
  await a.keyboard.press('Control+z');
  for (const page of [a, b]) await expect.poll(() => position(page, x), { timeout: 2_000 }).toEqual(p0);
  expect(await nodeIds(b)).toEqual([x, y].sort());
  expect(await b.evaluate(() => window.__history!.canUndo())).toBe(bCanUndo);

  // A's next undo reverts A's own add only; B's Y stays everywhere.
  await a.keyboard.press('Control+z');
  for (const page of [a, b]) await expect.poll(() => nodeIds(page), { timeout: 2_000 }).toEqual([y]);
  expect(errors).toEqual([]);
});

test('a viewer’s mutating shortcuts and menu items do nothing; navigation still works (AC-005, AC-019, AC-021)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  projectId = await createProjectFor(emailA, 'E2E F10 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  await closeProjectSidebar(a);
  const x = await dropShape(a, 'rectangle', { x: 640, y: 400 });
  await openCanvas(b, projectId, false);
  await closeProjectSidebar(b);
  await expect(node(b, x)).toBeVisible();

  // AC-005: zoom buttons only.
  const bar = b.getByRole('toolbar', { name: 'Canvas controls' });
  const labels = await bar.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(labels).toEqual(['Zoom out', 'Fit view', 'Zoom in']);
  await expect(bar.getByRole('separator')).toHaveCount(0);

  // A read-only node takes no pointer events; B presses where it is drawn, then every mutating key.
  const box = (await node(b, x).boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await b.mouse.click(centre.x, centre.y);
  await expect(b.locator('.react-flow__node.selected')).toHaveCount(0);
  for (const key of ['Delete', 'Backspace', 'Control+z', 'Control+d', 'Control+a']) await b.keyboard.press(key);
  await expect(b.locator('.react-flow__node.selected')).toHaveCount(0);

  // Right-click on the node or the pane: only the pane's navigation items.
  for (const at of [centre, { x: 1000, y: 200 }]) {
    await b.mouse.click(at.x, at.y, { button: 'right' });
    await expect(menu(b).getByRole('menuitem')).toHaveText(['Fit viewShift+1', 'Keyboard shortcuts?']);
    await b.keyboard.press('Escape');
    await expect(menu(b)).toHaveCount(0);
  }
  await a.waitForTimeout(1_000);
  expect(await nodeIds(a)).toEqual([x]);
  expect(await nodeIds(b)).toEqual([x]);

  // Navigation keys still work for the viewer; the cheat-sheet lists the navigation rows only.
  await clickEmpty(b);
  for (const [key, grows] of [
    ['=', true],
    ['-', false],
  ] as const) {
    const from = (await getViewport(b)).zoom;
    await b.keyboard.press(key);
    await b.waitForTimeout(350);
    expect((await getViewport(b)).zoom > from, key).toBe(grows);
  }
  await b.evaluate(() => window.__rf!.setViewport({ x: -4000, y: -4000, zoom: 1 }));
  await b.keyboard.press('Shift+Digit1');
  await expect(node(b, x)).toBeInViewport();
  await b.keyboard.press('?');
  const sheet = b.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet.getByRole('rowheader')).toHaveText(['Pan', 'Zoom', 'Fit view', 'Keyboard shortcuts']);
});
