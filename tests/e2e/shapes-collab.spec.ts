import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { dropShape, openCanvas } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F07 node creation across two real Clerk users in one Liveblocks room (cloud Development project, F05 Ruling).

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

/** What the other client must agree on: id, flow position (transform) and stored size. */
const renderedNode = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`).evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { transform: s.transform, width: s.width, height: s.height };
  });

test('a shape dropped by editor A reaches editor B with the same id, position and size (AC-010)', async ({ twoUsers }) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F07 collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);

  const droppedAt = Date.now();
  const id = await dropShape(a, 'diamond', { x: 700, y: 400 });
  expect(id).toMatch(/^diamond_[0-9A-HJKMNP-TV-Z]{26}$/);
  await expect(b.locator(`.react-flow__node[data-id="${id}"]`)).toBeVisible({ timeout: 1_000 });
  test.info().annotations.push({ type: 'remote-render-ms', description: String(Date.now() - droppedAt) });

  const onA = await renderedNode(a, id);
  expect(onA).toMatchObject({ width: '140px', height: '140px' });
  expect(await renderedNode(b, id)).toEqual(onA);
  // Selection is local: A's new node is selected on A only.
  await expect(b.locator('.react-flow__node.selected')).toHaveCount(0);
});

test('a viewer has no palette, cannot create through the write path, and cannot drag a node (AC-020; F12 AC-024)', async ({
  twoUsers,
}) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  projectId = await createProjectFor(emailA, 'E2E F07 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  const id = await dropShape(a, 'rectangle', { x: 700, y: 400 });
  const before = await renderedNode(a, id);

  await openCanvas(b, projectId, false);
  const nodeOnB = b.locator(`.react-flow__node[data-id="${id}"]`);
  await expect(nodeOnB).toBeVisible();
  await expect(b.getByRole('toolbar', { name: 'Shape palette' })).toHaveCount(0);

  // The client write path refuses (the read-only token would reject it anyway, F05).
  expect(await b.evaluate(() => window.__canvasMutations!.addNode('circle', { x: 0, y: 0 }))).toBeNull();

  // Dragging the node does nothing, locally or for A.
  const box = (await nodeOnB.boundingBox())!;
  await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await b.mouse.down();
  await b.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 + 120, { steps: 10 });
  await b.mouse.up();

  await a.waitForTimeout(2_000);
  expect(await renderedNode(b, id)).toEqual(before);
  expect(await renderedNode(a, id)).toEqual(before);
  await expect(a.locator('.react-flow__node')).toHaveCount(1);
  await expect(b.locator('.react-flow__node')).toHaveCount(1);
});
