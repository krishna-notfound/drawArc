import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { dropShape, openCanvas } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F08 node editing across two real Clerk users in one Liveblocks room: resize, label and colour reach the other
// editor; a node deleted under an open editor closes it cleanly; a viewer gets no editing affordance.

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const editor = (page: Page) => page.getByRole('textbox', { name: 'Node label' });

const stored = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const n = window.__rf!.getNode(nodeId);
    return n ? { width: n.width, height: n.height, label: n.data.label, color: n.data.color } : null;
  }, id);

test('resize, label and colour by editor A reach editor B; deleting a node under B’s open editor closes it (AC-004, AC-014)', async ({
  twoUsers,
}) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F08 collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  const errorsOnB: string[] = [];
  b.on('console', (msg) => {
    if (msg.type() === 'error') errorsOnB.push(msg.text());
  });
  b.on('pageerror', (err) => errorsOnB.push(err.message));

  const id = await dropShape(a, 'rectangle', { x: 640, y: 400 });
  await expect(node(b, id)).toBeVisible();

  // Resize (AC-004): B renders the stored 240 × 120 within 1 s of A's release.
  const handle = (await node(a, id).locator('.react-flow__resize-control.handle.bottom.right').boundingBox())!;
  await a.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await a.mouse.down();
  await a.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2 + 40, { steps: 10 });
  await a.mouse.up();
  await expect(node(b, id)).toHaveCSS('width', '240px', { timeout: 1_000 });
  await expect(node(b, id)).toHaveCSS('height', '120px');

  // Label and colour.
  await node(a, id).dblclick();
  await a.keyboard.type('Gateway');
  await a.keyboard.press('Enter');
  await a.getByRole('radio', { name: 'Colour: purple' }).click();
  await expect.poll(() => stored(b, id), { timeout: 2_000 }).toEqual({ width: 240, height: 120, label: 'Gateway', color: 'purple' });
  await expect(node(b, id)).toContainText('Gateway');

  // Delete under an open editor (AC-014): B's editor disappears without writing; the node stays gone.
  await node(b, id).dblclick();
  await expect(editor(b)).toBeFocused();
  await b.keyboard.type(' typing…');
  await a.evaluate((nodeId) => {
    const target = window.__rf!.getNode(nodeId)!;
    return window.__canvasMutations!.onDelete({ nodes: [target], edges: [] });
  }, id);
  await expect(editor(b)).toHaveCount(0, { timeout: 1_000 });
  await b.waitForTimeout(1_500);
  await expect(a.locator('.react-flow__node')).toHaveCount(0);
  await expect(b.locator('.react-flow__node')).toHaveCount(0);
  expect(errorsOnB).toEqual([]);
});

test('a viewer cannot select, resize, recolour or relabel a node (AC-019)', async ({ twoUsers }) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  projectId = await createProjectFor(emailA, 'E2E F08 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  const id = await dropShape(a, 'rectangle', { x: 640, y: 400 });
  await node(a, id).dblclick();
  await a.keyboard.type('API');
  await a.keyboard.press('Enter');

  await openCanvas(b, projectId, false);
  await expect(node(b, id)).toContainText('API');
  // A read-only node takes no pointer events (React Flow), so press where it is drawn, as a user would.
  const box = (await node(b, id).boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await b.mouse.click(centre.x, centre.y);
  await expect(node(b, id)).not.toHaveClass(/\bselected\b/);
  await expect(b.locator('.react-flow__resize-control')).toHaveCount(0);
  await expect(b.getByRole('radiogroup', { name: 'Node colour' })).toHaveCount(0);

  await b.mouse.dblclick(centre.x, centre.y);
  await node(b, id).focus();
  await b.keyboard.press('Enter');
  await expect(editor(b)).toHaveCount(0);

  // The write path refuses too (the read-only token would reject the write anyway, F05).
  await b.evaluate((nodeId) => window.__canvasMutations!.updateNodeData(nodeId, { label: 'x' }), id);
  await b.evaluate((nodeId) => window.__canvasMutations!.updateNodesData([nodeId], { color: 'red' }), id);
  await a.waitForTimeout(2_000);
  expect(await stored(a, id)).toMatchObject({ label: 'API', color: 'neutral' });
  expect(await stored(b, id)).toMatchObject({ label: 'API', color: 'neutral' });
});
