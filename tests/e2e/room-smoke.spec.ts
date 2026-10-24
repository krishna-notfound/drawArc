import { expect, test } from './fixtures/two-users';
import { deleteRoom } from './helpers/liveblocks';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

// Joins the project room through the test-only page (/e2e/room/[id], NEXT_PUBLIC_E2E_HOOKS=1) until F06 mounts
// ProjectRoom in the workspace. Tokens come from the real /api/liveblocks-auth route.
test('two sessions join the same project room and both connect (F05 AC-010, AC-021)', async ({ twoUsers }) => {
  const { a, b, distinctUsers, emailA, emailB } = twoUsers;
  const projectId = await createProjectFor(emailA, 'E2E room smoke');
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  const sockets: string[] = [];
  a.on('websocket', (ws) => sockets.push(ws.url()));

  try {
    const response = await a.goto(`/e2e/room/${projectId}`);
    // ClientSideSuspense always server-renders its fallback.
    expect(await response?.text()).toContain('Connecting to project…');
    await b.goto(`/e2e/room/${projectId}`);

    for (const page of [a, b]) {
      const room = page.locator('[data-slot="project-room"]');
      await expect(room).toHaveAttribute('data-connection-status', 'connected', { timeout: 10_000 });
      await expect(room).toHaveAttribute('data-can-write', 'true');
      await expect(page.getByText('Room connected')).toBeVisible();
    }
    expect(sockets.some((url) => url.includes(`roomId=${projectId}`))).toBe(true);
  } finally {
    await deleteProject(projectId);
    await deleteRoom(projectId);
  }
});
