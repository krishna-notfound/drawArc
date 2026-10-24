import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { getViewport, openCanvas, setViewport } from './helpers/canvas';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F14 starter templates across two real Clerk users in one Liveblocks room.

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

declare global {
  interface Window {
    __nodeCounts?: number[];
  }
}

const importButton = (page: Page) => page.getByRole('button', { name: 'Import a starter template' });
const nodeIds = (page: Page) => page.evaluate(() => window.__rf!.getNodes().map((n) => n.id).sort());
const edgeCount = (page: Page) => page.evaluate(() => window.__rf!.getEdges().length);
const replacedToast = (page: Page, template: string) =>
  page.getByText(new RegExp(`replaced the diagram with "${template}"`));

/** Records every node count B renders, so an intermediate empty canvas would be caught. */
const recordNodeCounts = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('.react-flow__nodes')!;
    const counts: number[] = [];
    window.__nodeCounts = counts;
    new MutationObserver(() => counts.push(root.querySelectorAll('.react-flow__node').length)).observe(root, {
      childList: true,
    });
  });

test('an import replaces the canvas for both users in one step, with one undo for the importer and a toast for the other (AC-006, AC-010, AC-011, AC-013, AC-014, AC-016)', async ({
  twoUsers,
}) => {
  test.setTimeout(180_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F14 templates');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  const viewportB = { x: -100, y: 50, zoom: 1.4 };
  await setViewport(b, viewportB);

  // Empty canvas: no confirmation; ids are fresh on every import.
  await importButton(a).click();
  const dialog = a.getByRole('dialog', { name: 'Starter templates' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: /^Preview of / })).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Import Event-driven system' }).click();
  await expect(dialog).toBeHidden();
  await expect(a.locator('.react-flow__node')).toHaveCount(10);
  await expect(b.locator('.react-flow__node')).toHaveCount(10);
  const eventIds = await nodeIds(a);
  await expect.poll(() => nodeIds(b)).toEqual(eventIds);
  await expect(replacedToast(b, 'Event-driven system')).toBeVisible();
  await expect(b.getByRole('button', { name: 'Fit view' })).toBeVisible();
  await expect(replacedToast(a, 'Event-driven system')).toHaveCount(0);

  // Non-empty canvas: Cancel changes nothing; "Replace diagram" swaps the diagram in one batch.
  await recordNodeCounts(b);
  await importButton(a).click();
  await dialog.getByRole('button', { name: 'Import Microservices' }).click();
  const confirm = a.getByRole('dialog', { name: 'Replace the current diagram?' });
  await expect(confirm).toContainText('This replaces the current diagram for everyone in this project. You can undo it.');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  expect(await nodeIds(a)).toEqual(eventIds);

  const started = Date.now();
  await dialog.getByRole('button', { name: 'Import Microservices' }).click();
  await confirm.getByRole('button', { name: 'Replace diagram' }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeHidden();
  await expect(b.locator('.react-flow__node')).toHaveCount(9, { timeout: 2_000 });
  test.info().annotations.push({ type: 'import-render-ms', description: String(Date.now() - started) });
  const microIds = await nodeIds(a);
  expect(microIds).toHaveLength(9);
  expect(microIds.some((id) => eventIds.includes(id))).toBe(false);
  await expect.poll(() => nodeIds(b)).toEqual(microIds);
  await expect.poll(() => edgeCount(b)).toBe(8);
  const counts = await b.evaluate(() => window.__nodeCounts!);
  expect(counts.length).toBeGreaterThan(0);
  expect(Math.min(...counts)).toBeGreaterThan(0);
  await expect(replacedToast(b, 'Microservices')).toBeVisible();

  // Only the importer's viewport is fitted.
  await expect.poll(() => getViewport(b)).toEqual(viewportB);
  const aNodes = a.locator('.react-flow__node');
  for (let i = 0; i < 9; i++) await expect(aNodes.nth(i)).toBeInViewport();

  // One undo restores the previous diagram (same ids) for everyone; redo re-applies the template.
  await a.evaluate(() => window.__history!.undo());
  for (const page of [a, b]) {
    await expect.poll(() => nodeIds(page), { timeout: 2_000 }).toEqual(eventIds);
    await expect.poll(() => edgeCount(page)).toBe(11);
  }
  await a.evaluate(() => window.__history!.redo());
  await expect.poll(() => nodeIds(b), { timeout: 2_000 }).toEqual(microIds);
});

test('a viewer has no Import and cannot import through the hook (AC-005, AC-015)', async ({ twoUsers }) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  projectId = await createProjectFor(emailA, 'E2E F14 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId, false);

  await expect(importButton(a)).toBeVisible();
  await expect(b.getByRole('button', { name: 'Share project' })).toBeVisible();
  await expect(importButton(b)).toHaveCount(0);
  await b.evaluate(() => window.__importTemplate?.('microservices'));
  await a.waitForTimeout(2_000);
  await expect(a.locator('.react-flow__node')).toHaveCount(0);
  await expect(b.locator('.react-flow__node')).toHaveCount(0);
});
