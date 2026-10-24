import { neon } from '@neondatabase/serverless';
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/two-users';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

/** The id and the presence name the auth route puts in the token (`name ?? email`). */
async function presenceUser(email: string): Promise<{ id: string; name: string }> {
  const rows = await neon(process.env.DATABASE_URL!)`
    SELECT id, name, email FROM "User" WHERE email = ${email.toLowerCase()} AND "deletedAt" IS NULL`;
  const row = rows[0] as { id: string; name: string | null; email: string } | undefined;
  if (!row) throw new Error(`no User row for ${email}`);
  return { id: row.id, name: row.name ?? row.email };
}

/** `translate(x, y) scale(z)` of the React Flow viewport (the pane starts at the window origin). */
async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  const transform = (await page.locator('.react-flow__viewport').getAttribute('style')) ?? '';
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(transform);
  if (!match) throw new Error(`unexpected viewport transform: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

// F11: B's live cursor and avatar on A's canvas, A never sees itself, pane leave clears the cursor, and the
// stack follows join/leave. Both users run against the cloud Liveblocks Development project (F05 Ruling).
test('collaborators see each other: cursor with name in flow coordinates, avatar stack join/leave (F11)', async ({
  twoUsers,
}) => {
  test.setTimeout(120_000);
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  test.skip(!distinctUsers, 'needs E2E user B');
  const [userA, userB] = await Promise.all([presenceUser(emailA), presenceUser(emailB)]);
  const projectId = await createProjectFor(emailA, 'E2E F11 presence');
  await addMember(projectId, emailB, 'EDITOR');
  const consoleErrors: string[] = [];
  a.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    // A alone (AC-010, AC-016): the corner holds only the UserButton, no divider; editor home has no stack.
    await a.setViewportSize({ width: 1280, height: 800 });
    await a.goto(`/editor/${projectId}`);
    await expect(a.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', 'true', { timeout: 20_000 });
    const stackA = a.getByTestId('presence-stack');
    await expect(stackA.locator('> :last-child .cl-userButtonTrigger')).toBeVisible({ timeout: 10_000 });
    await expect(stackA.getByTestId('presence-avatar')).toHaveCount(0);
    await expect(stackA.getByTestId('presence-divider')).toHaveCount(0);

    // B joins (AC-014): B's avatar appears on A's stack within 1 s of B's room connecting.
    await b.setViewportSize({ width: 1280, height: 800 });
    await b.goto(`/editor/${projectId}`);
    await expect(b.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', 'true', { timeout: 20_000 });
    const avatarB = stackA.locator(`[data-testid="presence-avatar"][data-user-id="${userB.id}"]`);
    await expect(avatarB).toBeVisible({ timeout: 1_000 });
    await expect(stackA.getByTestId('presence-avatar')).toHaveCount(1);
    await expect(stackA.getByTestId('presence-divider')).toHaveCount(1);
    await expect(stackA.getByRole('group', { name: `1 other person here: ${userB.name}` })).toBeVisible();
    await expect(avatarB.getByRole('img', { name: userB.name })).toBeVisible();
    const box = (await stackA.boundingBox())!;
    expect(box.y).toBeLessThan(64);
    expect(1280 - (box.x + box.width)).toBeLessThanOrEqual(16);
    // Keyboard reachable with a name tooltip, but no action (AC-012).
    await avatarB.focus();
    await expect(a.getByRole('tooltip')).toHaveText(userB.name);
    await a.keyboard.press('Enter');
    expect(a.url()).toContain(`/editor/${projectId}`);
    // A never appears in A's own stack.
    await expect(stackA.locator(`[data-user-id="${userA.id}"]`)).toHaveCount(0);

    // B moves over the pane (AC-003): A sees exactly one cursor for B, named, at B's flow point.
    const start = await viewport(b);
    const screenB = { x: 760, y: 420 };
    const flowPoint = { x: (screenB.x - start.x) / start.zoom, y: (screenB.y - start.y) / start.zoom };
    const movedAt = Date.now();
    await b.mouse.move(screenB.x - 40, screenB.y - 40);
    await b.mouse.move(screenB.x, screenB.y, { steps: 5 });
    const cursorB = a.locator(`[data-testid="remote-cursor"][data-user-id="${userB.id}"]`);
    await expect(cursorB).toBeVisible({ timeout: 2_000 });
    test.info().annotations.push({ type: 'cursor-render-ms', description: String(Date.now() - movedAt) });
    await expect(a.getByTestId('remote-cursor')).toHaveCount(1);
    await expect(cursorB).toHaveText(userB.name);
    await expect(cursorB).toHaveAttribute('aria-hidden', 'true');

    const expectAtFlowPoint = async () => {
      const view = await viewport(a);
      const expected = { x: flowPoint.x * view.zoom + view.x, y: flowPoint.y * view.zoom + view.y };
      await expect
        .poll(async () => {
          const at = (await cursorB.boundingBox())!;
          return Math.max(Math.abs(at.x - expected.x), Math.abs(at.y - expected.y));
        })
        .toBeLessThanOrEqual(4);
    };
    await expectAtFlowPoint();
    const size = (await cursorB.boundingBox())!;

    // A pans (scroll pans the canvas) and zooms (ctrl + wheel): the cursor stays on B's flow point and keeps
    // its screen size (EC-008).
    await a.mouse.move(900, 600);
    await a.mouse.wheel(200, 0);
    await expect.poll(async () => (await viewport(a)).x).not.toBe(start.x);
    await expectAtFlowPoint();
    await a.keyboard.down('Control');
    await a.mouse.wheel(0, 400);
    await a.keyboard.up('Control');
    await expect.poll(async () => (await viewport(a)).zoom).toBeLessThan(1);
    await expectAtFlowPoint();
    const zoomedSize = (await cursorB.boundingBox())!;
    expect(zoomedSize.width).toBeCloseTo(size.width, 1);
    expect(zoomedSize.height).toBeCloseTo(size.height, 1);

    // A's own pointer (AC-005): never drawn on A's canvas, drawn on B's.
    await expect(a.locator(`[data-testid="remote-cursor"][data-user-id="${userA.id}"]`)).toHaveCount(0);
    await expect(b.locator(`[data-testid="remote-cursor"][data-user-id="${userA.id}"]`)).toBeVisible({ timeout: 2_000 });

    // B moves onto the open project sidebar, off the pane (AC-006): B's cursor leaves A's canvas within 1 s.
    // The workspace sidebar starts closed; B opens it from the keyboard so the pointer stays on the pane.
    await b.getByRole('button', { name: 'Open projects sidebar' }).press('Enter');
    await expect(b.locator('aside[data-side="left"][data-state="open"]')).toBeVisible();
    await b.mouse.move(120, 400, { steps: 5 });
    await expect(cursorB).toBeHidden({ timeout: 1_000 });

    // B leaves (AC-014): B's avatar and the divider are gone within lostConnectionTimeout + 2 s.
    await b.context().close();
    await expect(avatarB).toHaveCount(0, { timeout: 7_000 });
    await expect(stackA.getByTestId('presence-divider')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);

    // Editor home (AC-016): no presence stack, the navbar's UserButton is still there.
    await a.goto('/editor');
    await expect(a.locator('.cl-userButtonTrigger')).toBeVisible({ timeout: 10_000 });
    await expect(a.getByTestId('presence-stack')).toHaveCount(0);
  } finally {
    await deleteProject(projectId);
    await deleteRoom(projectId);
  }
});
