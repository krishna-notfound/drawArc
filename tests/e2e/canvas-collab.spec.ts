import { expect, test } from './fixtures/two-users';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F06: the workspace mounts ProjectRoom + FlowCanvas; nodes live in Liveblocks Storage (cloud Development project,
// since the Liveblocks dev server does not run on Windows — F05 Ruling). Nodes are added with the F07 palette
// (a click places the shape at the canvas centre).
test('a node added by one editor appears for the other without a refresh, flush canvas, no viewport jump (F06 AC-012, AC-014, AC-020)', async ({
  twoUsers,
}) => {
  // Two Clerk sessions plus two Liveblocks connections on a dev server.
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  const projectId = await createProjectFor(emailA, 'E2E F06 canvas collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');

  try {
    for (const page of [a, b]) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/editor/${projectId}`);
      await expect(page.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', 'true', { timeout: 20_000 });
    }

    // Flush, full-viewport surface (reference bug "floating card"): the canvas is the whole window and its
    // root has no border, radius, shadow or padding; the sidebar, when open, overlaps it instead of shrinking it.
    expect(await a.locator('.react-flow').boundingBox()).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
    const rootStyle = await a.locator('[data-slot="flow-canvas"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.borderTopWidth, s.borderRadius, s.boxShadow, s.padding];
    });
    expect(rootStyle).toEqual(['0px', '0px', 'none', '0px']);

    // A adds a node on the empty canvas; B sees the same node id without a refresh.
    const viewport = a.locator('.react-flow__viewport');
    const transformBefore = await viewport.getAttribute('style');
    const addedAt = Date.now();
    await a.getByRole('button', { name: 'Add rectangle' }).click();
    const nodeOnA = a.locator('.react-flow__node');
    await expect(nodeOnA).toHaveCount(1);
    const nodeId = await nodeOnA.getAttribute('data-id');
    expect(nodeId).toMatch(/^rectangle_[0-9A-HJKMNP-TV-Z]{26}$/);
    await expect(b.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeVisible({ timeout: 1_000 });
    test.info().annotations.push({ type: 'remote-render-ms', description: String(Date.now() - addedAt) });

    // No auto-zoom on the first add (reference bug): the viewport transform is unchanged a second later.
    await a.waitForTimeout(1_000);
    expect(await viewport.getAttribute('style')).toBe(transformBefore);

    // And the other direction: B's node reaches A.
    await b.getByRole('button', { name: 'Add rectangle' }).click();
    await expect(a.locator('.react-flow__node')).toHaveCount(2, { timeout: 1_000 });
    await expect(b.locator('.react-flow__node')).toHaveCount(2);
  } finally {
    await deleteProject(projectId);
    await deleteRoom(projectId);
  }
});
