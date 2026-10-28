import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { deleteSnapshot } from './helpers/blob';
import { getViewport, openCanvas, pressCanvasKey } from './helpers/canvas';
import { clearRoomStorage, deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F22 text and sticky notes across two real Clerk users in one Liveblocks room: the committed size reaches B
// unwrapped and the v2 snapshot round-trips (AC-019), Escape / Backspace / a remote delete under an open editor
// (AC-012), and the viewer gate (AC-018).

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  await deleteSnapshot(projectId);
  projectId = undefined;
});

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const editor = (page: Page) => page.getByRole('textbox', { name: 'Node label' });

const stored = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const n = window.__rf!.getNode(nodeId);
    return n ? { width: n.width!, height: n.height!, label: n.data.label, color: n.data.color } : null;
  }, id);

const selectedId = async (page: Page) => {
  const selected = page.locator('.react-flow__node.selected');
  await expect(selected).toHaveCount(1);
  return (await selected.getAttribute('data-id'))!;
};

/** Creates a labelled text node with `T` and returns its id once the label is committed. */
async function createText(page: Page, label: string): Promise<string> {
  await pressCanvasKey(page, 't');
  const id = await selectedId(page);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type(label);
  await page.keyboard.press('Enter');
  await expect.poll(() => stored(page, id).then((s) => s?.label)).toBe(label);
  return id;
}

test('committed size reaches B unwrapped within 1 s and the v2 snapshot round-trips (AC-019)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F22 collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);

  const textId = await createText(a, 'Deploy');
  await pressCanvasKey(a, 'n');
  const stickyId = await selectedId(a);
  await node(a, stickyId).dblclick({ position: { x: 30, y: 30 } });
  await a.keyboard.type('Idea');
  await a.keyboard.press('Enter');
  await expect.poll(() => stored(a, stickyId).then((s) => s?.label)).toBe('Idea');

  const zoomB = (await getViewport(b)).zoom;
  for (const id of [textId, stickyId]) {
    const mine = (await stored(a, id))!;
    await expect(node(b, id)).toBeVisible({ timeout: 1_000 });
    // B renders the stored size within 1 s of the commit (the node exists from its creation, so the size is polled).
    await expect
      .poll(
        async () => {
          const box = await node(b, id).boundingBox();
          return box ? [Math.abs(box.width / zoomB - mine.width) <= 1, Math.abs(box.height / zoomB - mine.height) <= 1] : null;
        },
        { timeout: 1_000 },
      )
      .toEqual([true, true]);
  }
  // The label box (padding included) fills the stored height on B: one line, no wrap.
  const textStored = (await stored(a, textId))!;
  const labelBox = (await node(b, textId).locator('[data-slot="node-label"]').boundingBox())!;
  expect(Math.abs(labelBox.height / zoomB - textStored.height)).toBeLessThanOrEqual(1);

  // Save, lose the room's Storage, and reopen: the v2 snapshot seeds it back unchanged.
  const saveButton = a.locator('[data-slot="save-button"]');
  await saveButton.click();
  await expect(saveButton).toHaveText(/^Saved/, { timeout: 30_000 });
  const before = { text: await stored(a, textId), sticky: await stored(a, stickyId) };
  await a.goto('about:blank');
  await clearRoomStorage(projectId);
  await openCanvas(a, projectId);
  await expect(node(a, textId)).toBeVisible();
  await expect(node(a, stickyId)).toBeVisible();
  expect({ text: await stored(a, textId), sticky: await stored(a, stickyId) }).toEqual(before);

  const res = await a.request.get(`/api/projects/${projectId}/canvas`);
  const body = (await res.json()) as {
    schemaVersion: number;
    document: { nodes: { id: string; width: number; height: number; data: { label: string } }[] };
  };
  expect(body.schemaVersion).toBe(2);
  for (const [id, mine] of [
    [textId, before.text],
    [stickyId, before.sticky],
  ] as const) {
    const saved = body.document.nodes.find((n) => n.id === id)!;
    expect([saved.width, saved.height, saved.data.label]).toEqual([mine!.width, mine!.height, mine!.label]);
  }
});

test('Escape keeps the label; Backspace edits only; B deleting under A’s editor closes it without a write (AC-012)', async ({
  twoUsers,
}) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F22 collab editing');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  const errorsOnA: string[] = [];
  a.on('pageerror', (err) => errorsOnA.push(err.message));
  a.on('console', (msg) => {
    if (msg.type() === 'error') errorsOnA.push(msg.text());
  });

  const id = await createText(a, 'Keep');
  await expect(node(b, id)).toBeVisible();

  // Escape cancels: the draft is dropped on A and nothing reaches B.
  await node(a, id).dblclick();
  await expect(editor(a)).toBeFocused();
  await a.keyboard.type('Changed');
  await a.keyboard.press('Escape');
  await expect(editor(a)).toHaveCount(0);
  expect((await stored(a, id))?.label).toBe('Keep');
  expect((await stored(b, id))?.label).toBe('Keep');

  // Backspace edits the draft only; the node survives. Escape then keeps the stored label.
  await node(a, id).dblclick();
  await a.keyboard.press('Backspace');
  await a.keyboard.press('Backspace');
  await expect(a.locator('.react-flow__node')).toHaveCount(1);
  await a.keyboard.press('Escape');
  expect((await stored(a, id))?.label).toBe('Keep');

  // B deletes the node under A's open editor: the editor closes, nothing is written or restored.
  await node(a, id).dblclick();
  await expect(editor(a)).toBeFocused();
  await node(b, id).click();
  await b.keyboard.press('Delete');
  await expect(editor(a)).toHaveCount(0, { timeout: 2_000 });
  await expect(a.locator('.react-flow__node')).toHaveCount(0);
  await expect(b.locator('.react-flow__node')).toHaveCount(0);
  await a.waitForTimeout(1_000);
  await expect(a.locator('.react-flow__node')).toHaveCount(0);
  expect(errorsOnA).toEqual([]);
});

test('a viewer cannot create text or stickies by key or by the exposed mutation (AC-018)', async ({ twoUsers }) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs a second Clerk user to be a viewer');
  projectId = await createProjectFor(emailA, 'E2E F22 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId, false);

  await b.mouse.click(1000, 180);
  await b.keyboard.press('t');
  await b.keyboard.press('n');
  const created = await b.evaluate(() => window.__canvasMutations!.addNodeOfKind('text', { x: 0, y: 0 }));
  expect(created).toBeNull();

  await a.waitForTimeout(2_000);
  await expect(a.locator('.react-flow__node')).toHaveCount(0);
  await expect(b.locator('.react-flow__node')).toHaveCount(0);
  await expect(b.getByRole('toolbar', { name: 'Shape palette' })).toHaveCount(0);
  await expect(b.locator('.react-flow__resize-control')).toHaveCount(0);
  await expect(b.getByRole('radiogroup', { name: 'Node colour' })).toHaveCount(0);
});
