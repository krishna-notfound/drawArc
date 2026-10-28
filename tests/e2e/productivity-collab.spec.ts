import { expect as baseExpect, type Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { addNodeAt, dropShape, nodePosition, openCanvas, setViewport } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F10 v2 across two real Clerk users in one Liveblocks room: Cut and Paste travel the collaborative path in one
// undo step, paste lands where the pointer is, align and distribute are one undo step each, and a remote change
// leaves the local redo stack alone (AC-042, unverified against Liveblocks until this spec ran).

const projectIds: string[] = [];

test.afterEach(async () => {
  for (const id of projectIds.splice(0)) {
    await deleteProject(id);
    await deleteRoom(id);
  }
});

const nodeIds = (page: Page) => page.evaluate(() => window.__rf!.getNodes().map((n) => n.id).sort());
const edgeIds = (page: Page) => page.evaluate(() => window.__rf!.getEdges().map((e) => e.id).sort());
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const control = (page: Page, name: string) => page.getByRole('toolbar', { name: 'Canvas controls' }).getByRole('button', { name, exact: true });
const menu = (page: Page) => page.getByRole('menu');

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

/** Liveblocks 3.24.4 loses an undo issued before the server acknowledged the change it reverts (Ruling F10-R7). */
const settle = (page: Page) => page.waitForTimeout(1_000);

/** Bounding-box centre in flow coordinates of the listed nodes (stored position + width/height). */
const centreOf = (page: Page, ids: string[]) =>
  page.evaluate((list) => {
    const boxes = list.map((id) => {
      const n = window.__rf!.getNode(id)!;
      return { x: n.position.x, y: n.position.y, w: n.width ?? 0, h: n.height ?? 0 };
    });
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }, ids);

async function setup(twoUsers: { a: Page; b: Page; distinctUsers: boolean; emailA: string; emailB: string }, name: string) {
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  const projectId = await createProjectFor(emailA, name);
  projectIds.push(projectId);
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  await closeProjectSidebar(a);
  await closeProjectSidebar(b);
  return { a, b, projectId };
}

test.use({ actionTimeout: 15_000 });

test('cut copies the selection and deletes it in one undo step on both clients (AC-028, EC-020)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b } = await setup(twoUsers, 'E2E F10 v2 cut');
  await a.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const x = await dropShape(a, 'rectangle', { x: 450, y: 300 });
  const y = await dropShape(a, 'rectangle', { x: 750, y: 300 });
  const z = await dropShape(a, 'rectangle', { x: 1050, y: 300 });
  const E = 'e_01JBE00000000000000000F11A'; // X → Y, internal to the selection
  const F = 'e_01JBE00000000000000000F11B'; // X → Z, leaves it
  await addEdge(a, E, x, y);
  await addEdge(a, F, x, z);
  await sameOnBoth(a, b, [x, y, z], [E, F], 5_000);

  await node(a, x).click();
  await node(a, y).click({ modifiers: ['Control'] });
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(2);
  await a.keyboard.press('Control+x');
  await sameOnBoth(a, b, [z], [], 1_000);

  const copied = JSON.parse((await a.evaluate(() => window.__clipboard!.text))!) as {
    nodes: Record<string, unknown>[];
    edges: { id: string }[];
  };
  expect(copied.nodes).toHaveLength(2);
  for (const n of copied.nodes) expect(Object.keys(n).sort()).toEqual(['data', 'height', 'id', 'position', 'type', 'width']);
  expect(copied.edges.map((e) => e.id)).toEqual([E]);

  // One undo restores both nodes and both edges; the clipboard text is untouched.
  await settle(a);
  await control(a, 'Undo').click();
  await sameOnBoth(a, b, [x, y, z], [E, F]);
  const textAfterUndo = await a.evaluate(() => window.__clipboard!.text);
  expect(JSON.parse(textAfterUndo!).nodes).toHaveLength(2);

  // Paste re-creates copies with fresh ids next to the originals.
  await a.keyboard.press('Control+v');
  await expect.poll(() => nodeIds(a), { timeout: 2_000 }).toHaveLength(5);
  await expect.poll(() => edgeIds(a)).toHaveLength(3);
  const pasted = (await nodeIds(a)).filter((id) => ![x, y, z].includes(id));
  expect(pasted).toHaveLength(2);
  await sameOnBoth(a, b, await nodeIds(a), await edgeIds(a));
});

test('paste lands at the pointer, at the viewport centre when off-canvas, and in a second tab of the same user (AC-032, EC-019)', async ({
  twoUsers,
}) => {
  test.setTimeout(180_000);
  const { a, b } = await setup(twoUsers, 'E2E F10 v2 paste');
  await a.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const x = await dropShape(a, 'rectangle', { x: 450, y: 300 });
  const y = await dropShape(a, 'rectangle', { x: 750, y: 300 });
  const E = 'e_01JBE00000000000000000F11C';
  await addEdge(a, E, x, y);
  await sameOnBoth(a, b, [x, y], [E], 5_000);
  await a.keyboard.press('Control+a');
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(2);
  await a.keyboard.press('Control+c');

  // At the pointer.
  await a.mouse.move(600, 500);
  await a.keyboard.press('Control+v');
  for (const page of [a, b]) {
    await expect.poll(() => nodeIds(page), { timeout: 1_500 }).toHaveLength(4);
    await expect.poll(() => edgeIds(page), { timeout: 1_500 }).toHaveLength(2);
  }
  const copies = (await nodeIds(a)).filter((id) => id !== x && id !== y);
  const target = await a.evaluate(() => window.__rf!.screenToFlowPosition({ x: 600, y: 500 }));
  const centre = await centreOf(a, copies);
  expect(Math.abs(centre.x - target.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(centre.y - target.y)).toBeLessThanOrEqual(2);
  // The pasted nodes and edge are exactly the selection.
  const selected = await a.evaluate(() => window.__rf!.getNodes().filter((n) => n.selected).map((n) => n.id).sort());
  expect(selected).toEqual([...copies].sort());
  expect(await a.locator('.react-flow__edge.selected').count()).toBe(1);

  // One undo removes the whole paste.
  await settle(a);
  await control(a, 'Undo').click();
  await sameOnBoth(a, b, [x, y], [E]);

  // Pointer off the canvas (over the project sidebar): the viewport centre.
  await a.getByRole('button', { name: 'Open projects sidebar' }).click();
  const sidebar = (await a.getByRole('complementary', { name: 'Projects' }).boundingBox())!;
  await a.mouse.move(sidebar.x + sidebar.width / 2, sidebar.y + sidebar.height / 2);
  await a.keyboard.press('Control+v');
  await expect.poll(() => nodeIds(a), { timeout: 2_000 }).toHaveLength(4);
  const copies2 = (await nodeIds(a)).filter((id) => id !== x && id !== y);
  const pane = (await a.locator('[data-slot="flow-canvas"]').boundingBox())!;
  const middle = await a.evaluate((p) => window.__rf!.screenToFlowPosition(p), { x: pane.x + pane.width / 2, y: pane.y + pane.height / 2 });
  const centre2 = await centreOf(a, copies2);
  expect(Math.abs(centre2.x - middle.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(centre2.y - middle.y)).toBeLessThanOrEqual(2);

  // A second tab of the same user, another project: the system clipboard carries the envelope.
  const projectId2 = await createProjectFor(twoUsers.emailA, 'E2E F10 v2 paste target');
  projectIds.push(projectId2);
  const tab = await a.context().newPage();
  await openCanvas(tab, projectId2);
  await closeProjectSidebar(tab);
  await tab.mouse.move(640, 400);
  await tab.keyboard.press('Control+v');
  await expect.poll(() => nodeIds(tab), { timeout: 3_000 }).toHaveLength(2);
  await expect.poll(() => edgeIds(tab)).toHaveLength(1);
  expect((await nodeIds(tab)).some((id) => [x, y, ...copies, ...copies2].includes(id))).toBe(false);
});

test('Ctrl+Shift+ArrowLeft aligns three nodes with one focused; toolbar and submenu align/distribute, one undo each (AC-037, AC-038, EC-027)', async ({
  twoUsers,
}) => {
  test.setTimeout(180_000);
  const { a, b } = await setup(twoUsers, 'E2E F10 v2 align');
  const P = await addNodeAt(a, 'rectangle', { x: 0, y: 0 });
  const Q = await addNodeAt(a, 'rectangle', { x: 50, y: 120 });
  const R = await addNodeAt(a, 'rectangle', { x: 400, y: 240 });
  await setViewport(a, { x: 300, y: 250, zoom: 1 });
  const xs = (page: Page) => Promise.all([P, Q, R].map(async (id) => (await nodePosition(page, id))?.x ?? null));
  const ys = (page: Page) => Promise.all([P, Q, R].map(async (id) => (await nodePosition(page, id))?.y ?? null));
  const xCentres = (page: Page) =>
    page.evaluate((ids) => ids.map((id) => window.__rf!.getNode(id)!.position.x + (window.__rf!.getNode(id)!.width ?? 0) / 2), [P, Q, R]);
  await expect.poll(() => xs(b), { timeout: 5_000 }).toEqual([0, 50, 400]);

  // Keyboard, with a node focused: React Flow's own Arrow-key nudge must not swallow it (capture phase).
  await a.keyboard.press('Control+a');
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(3);
  await node(a, P).focus();
  await a.keyboard.press('Control+Shift+ArrowLeft');
  for (const page of [a, b]) await expect.poll(() => xs(page), { timeout: 1_500 }).toEqual([0, 0, 0]);
  expect(await ys(a)).toEqual([0, 120, 240]);
  await settle(a);
  await a.keyboard.press('Control+z');
  for (const page of [a, b]) await expect.poll(() => xs(page), { timeout: 1_500 }).toEqual([0, 50, 400]);

  // Selection toolbar: eight buttons, the four edge ones carry aria-keyshortcuts.
  const toolbar = a.getByRole('toolbar', { name: 'Arrange selection' });
  await expect(toolbar.getByRole('button')).toHaveCount(8);
  await expect(toolbar.locator('button[aria-keyshortcuts]')).toHaveCount(4);
  await toolbar.getByRole('button', { name: 'Align centre (horizontal)' }).click();
  for (const page of [a, b]) {
    await expect.poll(async () => new Set(await xCentres(page)).size, { timeout: 1_500 }).toBe(1);
  }
  await settle(a);
  await control(a, 'Undo').click();
  for (const page of [a, b]) await expect.poll(() => xs(page), { timeout: 1_500 }).toEqual([0, 50, 400]);

  // Context-menu submenu: distribute horizontally. Rectangles are 180 wide: span 0..580, gap 20, middle x = 200.
  const box = (await node(a, Q).boundingBox())!;
  await a.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await menu(a).getByRole('menuitem', { name: 'Align' }).hover();
  await a.getByRole('menuitem', { name: 'Distribute horizontally' }).click();
  for (const page of [a, b]) await expect.poll(() => xs(page), { timeout: 1_500 }).toEqual([0, 200, 400]);
  await settle(a);
  await control(a, 'Undo').click();
  for (const page of [a, b]) await expect.poll(() => xs(page), { timeout: 1_500 }).toEqual([0, 50, 400]);

  // A single node: no toolbar, no Align entry.
  await a.mouse.click(1000, 180);
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(0);
  await node(a, P).click();
  await expect(a.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(toolbar).toHaveCount(0);
  await node(a, P).click({ button: 'right' });
  await expect(menu(a).getByRole('menuitem', { name: 'Copy' })).toBeVisible();
  await expect(menu(a).getByRole('menuitem', { name: 'Align' })).toHaveCount(0);
  await a.keyboard.press('Escape');
});

test('a remote change does not clear the local redo stack (AC-042 — Liveblocks behaviour unverified until this ran)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b } = await setup(twoUsers, 'E2E F10 v2 redo');
  const id = await dropShape(a, 'rectangle', { x: 600, y: 400 });
  await expect.poll(() => nodeIds(b), { timeout: 5_000 }).toEqual([id]);
  await settle(a);
  await control(a, 'Undo').click();
  await expect.poll(() => nodeIds(a)).toEqual([]);
  await expect(control(a, 'Redo')).toBeEnabled();

  // B changes the room while A holds a redo entry; B must have applied A's undo first, or its node count is stale.
  await expect.poll(() => nodeIds(b), { timeout: 5_000 }).toEqual([]);
  const other = await addNodeAt(b, 'circle', { x: 200, y: 200 });
  await expect.poll(() => nodeIds(a), { timeout: 3_000 }).toEqual([other]);
  await a.waitForTimeout(500);
  await expect(control(a, 'Redo')).toBeEnabled();

  await a.mouse.click(1000, 180);
  await a.keyboard.press('Control+Shift+z');
  await sameOnBoth(a, b, [id, other].sort(), [], 2_000);
});
