import { expect, test } from '@playwright/test';

import { userA } from './clerk-users';
import { deleteSnapshot } from './helpers/blob';
import { addShape, openCanvas } from './helpers/canvas';
import { clearRoomStorage, deleteRoom, roomFlowIds, roomFlowIsLive } from './helpers/liveblocks';
import { createProjectFor, deleteProject } from './helpers/projects';

// F13 recovery (M1 acceptance run step 5): the Blob snapshot restores a room whose Storage was lost. Runs against the
// Liveblocks Development project and the private `drawarc-blob` store; the spec removes its project, room and blob.

let projectId: string;

test.beforeEach(async () => {
  projectId = await createProjectFor(userA().email, 'E2E F13 persistence');
});

test.afterEach(async () => {
  await deleteProject(projectId);
  await deleteRoom(projectId);
  await deleteSnapshot(projectId);
});

test('a saved diagram is restored server-side into a cleared room and survives a reload (AC-022, AC-019)', async ({ page }) => {
  test.setTimeout(120_000);
  await openCanvas(page, projectId);
  const saveButton = page.locator('[data-slot="save-button"]');
  await expect(saveButton).toHaveText('Save');

  const nodeId = await addShape(page, 'rectangle');
  const position = await page.evaluate((id) => window.__rf!.getNode(id)!.position, nodeId);
  await expect.poll(() => roomFlowIds(projectId), { timeout: 15_000 }).toEqual({ nodes: [nodeId], edges: [] });

  await saveButton.click();
  // The first PUT compiles the route in dev and writes to the sin1 store: allow for both.
  await expect(saveButton).toHaveAttribute('data-status', 'saved', { timeout: 30_000 });
  await expect(saveButton).toHaveText(/^Saved · \d{2}:\d{2}$/);
  await expect(saveButton).toHaveText('Saved', { timeout: 6_000 });

  // Leave the room, then lose its Storage.
  await page.goto('about:blank');
  await clearRoomStorage(projectId);
  expect(await roomFlowIds(projectId)).toEqual({ nodes: [], edges: [] });

  // Reopen: the workspace gate seeds the empty room from Blob before rendering (D-034).
  await openCanvas(page, projectId);
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  await expect(node).toBeVisible();
  expect(await page.evaluate((id) => window.__rf!.getNode(id)!.position, nodeId)).toEqual(position);
  expect(await roomFlowIds(projectId)).toEqual({ nodes: [nodeId], edges: [] });
  await expect(page.locator('[data-slot="seed-warning"]')).toHaveCount(0);
  // The seed wrote Live structures (a plain-JSON `flow` renders but cannot be edited): the room stays editable.
  expect(await roomFlowIsLive(projectId)).toBe(true);
  const second = await addShape(page, 'circle');
  await expect.poll(() => roomFlowIds(projectId).then((ids) => ids.nodes.sort()), { timeout: 15_000 }).toEqual([nodeId, second].sort());
  // Save again (a 429 from the 10 s minimum interval is rescheduled by the hook) and read it back through GET.
  await saveButton.click();
  await expect(saveButton).toHaveAttribute('data-status', 'saved', { timeout: 30_000 });
  const snapshot = (await (await page.request.get(`/api/projects/${projectId}/canvas`)).json()) as {
    document: { nodes: { id: string }[] };
  };
  expect(snapshot.document.nodes.map((n) => n.id).sort()).toEqual([nodeId, second].sort());

  // Reload keeps both nodes (now from room Storage; the room is not empty, so nothing is re-seeded).
  await page.reload();
  await expect(page.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', 'true', { timeout: 20_000 });
  await expect(node).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
