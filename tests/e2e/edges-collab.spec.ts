import type { Page } from '@playwright/test';

import type { CanvasEdge, HandleId } from '@/types/canvas';

import { expect, test } from './fixtures/two-users';
import { dropShape, openCanvas } from './helpers/canvas';
import {
  centre,
  connect,
  dragTargetEnd,
  edgeGroup,
  edges,
  expectEdgeCount,
  handle,
  onlyEdge,
  pathMidpoint,
} from './helpers/edges';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// F09 edges across two real Clerk users in one Liveblocks room (cloud Development project, F05 Ruling).

let projectId: string | undefined;

test.afterEach(async () => {
  if (!projectId) return;
  await deleteProject(projectId);
  await deleteRoom(projectId);
  projectId = undefined;
});

const byId = (list: CanvasEdge[]) => [...list].sort((p, q) => p.id.localeCompare(q.id));
const edge = (n: number, source: string, sourceHandle: HandleId, target: string, targetHandle: HandleId, label?: string) =>
  ({
    id: `e_01JBE00000000000000000000${n}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'canvasEdge',
    data: label ? { label } : {},
  }) satisfies CanvasEdge;

const addEdges = (page: Page, items: CanvasEdge[]) =>
  page.evaluate((list) => list.forEach((item) => window.__canvasMutations!.addEdge(item)), items);

test('an edge drawn by A reaches B with its handles, arrowhead, label and reconnection (AC-005 sync, AC-009)', async ({
  twoUsers,
}) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F09 collab');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  const x = await dropShape(a, 'rectangle', { x: 500, y: 300 });
  const y = await dropShape(a, 'rectangle', { x: 1000, y: 300 });
  const z = await dropShape(a, 'rectangle', { x: 750, y: 560 });
  await expect(b.locator('.react-flow__node')).toHaveCount(3);

  let started = Date.now();
  await connect(a, [x, 'right'], [y, 'left']);
  const created = await onlyEdge(a);
  await expect.poll(() => edges(b), { timeout: 1_000 }).toEqual([created]);
  test.info().annotations.push({ type: 'edge-add-ms', description: String(Date.now() - started) });
  await expect(edgeGroup(b, created.id).locator('path.react-flow__edge-path')).toHaveAttribute('marker-end', /url/);

  const mid = await pathMidpoint(a, created.id);
  await a.mouse.dblclick(mid.x, mid.y);
  await a.getByRole('textbox', { name: 'Edge label' }).fill('HTTPS');
  await a.keyboard.press('Enter');
  await expect(b.locator(`[data-edge-label="${created.id}"]`).getByText('HTTPS')).toBeVisible({ timeout: 1_000 });

  started = Date.now();
  await dragTargetEnd(a, created.id, await centre(handle(a, z, 'top')));
  const reconnected = { ...created, target: z, targetHandle: 'top', data: { label: 'HTTPS' } };
  await expect.poll(() => edges(a)).toEqual([reconnected]);
  await expect.poll(() => edges(b), { timeout: 1_000 }).toEqual([reconnected]);
  test.info().annotations.push({ type: 'edge-reconnect-ms', description: String(Date.now() - started) });
});

test('deleting a node removes its edges atomically on both clients; undo restores node and edges; edge delete + undo (AC-015, AC-016)', async ({
  twoUsers,
}) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  projectId = await createProjectFor(emailA, 'E2E F09 cascade');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openCanvas(a, projectId);
  await openCanvas(b, projectId);
  const x = await dropShape(a, 'rectangle', { x: 750, y: 260 });
  const p = await dropShape(a, 'rectangle', { x: 500, y: 520 });
  const q = await dropShape(a, 'rectangle', { x: 1000, y: 520 });
  const attached = [edge(1, x, 'left', p, 'top'), edge(2, x, 'right', q, 'top'), edge(3, p, 'right', x, 'bottom')];
  const unrelated = [edge(4, p, 'bottom', q, 'bottom', 'SQL'), edge(5, q, 'left', p, 'left')];
  await addEdges(a, [...attached, ...unrelated]);
  await expect.poll(async () => byId(await edges(b))).toEqual(byId([...attached, ...unrelated]));

  await a.evaluate((id) => window.__canvasMutations!.onDelete({ nodes: [window.__rf!.getNode(id)!], edges: [] }), x);
  for (const page of [a, b]) {
    await expect.poll(async () => byId(await edges(page)), { timeout: 1_000 }).toEqual(byId(unrelated));
    await expect(page.locator(`.react-flow__node[data-id="${x}"]`)).toHaveCount(0);
  }

  // One undo restores the node and all three edges, for everyone.
  await a.evaluate(() => window.__history!.undo());
  for (const page of [a, b]) {
    await expect(page.locator(`.react-flow__node[data-id="${x}"]`)).toHaveCount(1, { timeout: 1_000 });
    await expect.poll(async () => byId(await edges(page)), { timeout: 1_000 }).toEqual(byId([...attached, ...unrelated]));
  }

  // AC-016: F10's edge-delete contract, then undo with the same id and label.
  const sql = unrelated[0];
  await a.evaluate((id) => window.__canvasMutations!.onDelete({ nodes: [], edges: [window.__rf!.getEdge(id)!] }), sql.id);
  await expectEdgeCount(b, 4, 1_000);
  await a.evaluate(() => window.__history!.undo());
  await expect.poll(async () => (await edges(b)).find((e) => e.id === sql.id), { timeout: 1_000 }).toEqual(sql);
});

test('a viewer cannot connect, reconnect, select or label edges (AC-018)', async ({ twoUsers }) => {
  test.setTimeout(150_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  projectId = await createProjectFor(emailA, 'E2E F09 viewer');
  await addMember(projectId, emailB, 'VIEWER');
  await openCanvas(a, projectId);
  const x = await dropShape(a, 'rectangle', { x: 500, y: 300 });
  const y = await dropShape(a, 'rectangle', { x: 1000, y: 300 });
  const e = edge(1, x, 'right', y, 'left');
  await addEdges(a, [e]);

  await openCanvas(b, projectId, false);
  await expect(b.locator('.react-flow__node')).toHaveCount(2);
  // Attached, not "visible": a straight horizontal path has a zero-height box.
  await expect(edgeGroup(b, e.id).locator('path.react-flow__edge-path')).toBeAttached();
  // Handles stay hidden on hover and dragging from one draws nothing. (Read-only nodes take no pointer events,
  // so the raw mouse is used instead of actionability-checked locator actions.)
  const nodeCentre = await centre(b.locator(`.react-flow__node[data-id="${x}"]`));
  await b.mouse.move(nodeCentre.x, nodeCentre.y);
  expect(await handle(b, x, 'bottom').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  const from = await centre(handle(b, x, 'bottom'));
  const to = await centre(handle(b, y, 'bottom'));
  await b.mouse.move(from.x, from.y);
  await b.mouse.down();
  await b.mouse.move(to.x, to.y, { steps: 12 });
  await b.mouse.up();
  // No selection, no reconnect anchors, no label editor.
  const mid = await pathMidpoint(b, e.id);
  await b.mouse.click(mid.x, mid.y);
  await expect(edgeGroup(b, e.id)).not.toHaveClass(/selected/);
  await expect(b.locator('.react-flow__edgeupdater')).toHaveCount(0);
  await b.mouse.dblclick(mid.x, mid.y);
  await expect(b.getByRole('textbox', { name: 'Edge label' })).toHaveCount(0);
  // The client write path refuses too (the read-only token would reject it anyway, F05).
  await b.evaluate((item) => window.__canvasMutations!.addEdge({ ...item, id: 'e_01JBE0000000000000000000ZZ' }), e);

  await a.waitForTimeout(2_000);
  expect(await edges(a)).toEqual([e]);
  expect(await edges(b)).toEqual([e]);
});
