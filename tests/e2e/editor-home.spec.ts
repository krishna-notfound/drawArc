import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { fixtures } from './db';

// F04 editor home + owner flow through the real F03 Server Actions. User A's project counts are not asserted:
// other specs (and parallel worktrees on the same dev database) create projects for A concurrently.

const DESKTOP = { width: 1280, height: 800 };
const NAVIGATION = { timeout: 15_000 };
const DENIED = "You can't open this project";
const CUID_URL = /\/editor\/c[a-z0-9]{8,}$/;

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
}

function sidebarRow(page: Page, name: string) {
  return page.locator('#project-sidebar li').filter({ has: page.getByRole('link', { name }) });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(DESKTOP);
});

test('home: empty-state prompt, lists streamed into a default-open sidebar without stealing focus (AC-001, FR-013 default)', async ({
  page,
}) => {
  await page.goto('/editor');
  await expect(page.getByRole('heading', { level: 1, name: 'Create a project or open an existing one' })).toBeVisible();
  await expect(page.getByText('Start a new architecture workspace, or choose a project from the sidebar.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'New Project' })).toBeVisible();

  const sidebar = page.locator('#project-sidebar');
  await expect(sidebar).toHaveAttribute('data-state', 'open');
  await expect(sidebar.getByRole('tab', { name: /^My Projects \d+$/ })).toHaveAttribute('aria-selected', 'true');
  await expect(sidebar.getByRole('tab', { name: /^Shared with me \d+$/ })).toBeVisible();
  // The automatic open leaves focus where it was (not inside the panel).
  expect(await page.evaluate(() => document.getElementById('project-sidebar')?.contains(document.activeElement))).toBe(false);
});

test('owner flow: create → workspace → rename → delete, lists update without reload (AC-007, AC-008, AC-010, AC-013, AC-015, AC-024, AC-025)', async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const name = `F04 Payments ${suffix}`;
  const renamed = `F04 Billing ${suffix}`;
  let projectId: string | undefined;

  try {
    await page.goto('/editor');
    // Wait for the gated boundaries to stream in: the empty state is first served as the Suspense fallback and
    // then swapped for the gated copy, which would drop the opener that Radix restores focus to.
    await expect(page.getByRole('banner').locator('.cl-userButtonTrigger')).toBeVisible(NAVIGATION);
    await expect(page.locator('#project-sidebar').getByRole('tab', { name: /^My Projects \d+$/ })).toBeVisible();
    const newProject = page.getByRole('main').getByRole('button', { name: 'New Project' });

    // Keyboard: Esc closes the dialog and focus returns to the opener (AC-024).
    await newProject.click();
    const dialog = page.getByRole('dialog', { name: 'Create project' });
    const input = dialog.getByRole('textbox', { name: 'Project name' });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('placeholder', 'Untitled Project');
    await expect(input).toHaveAttribute('maxlength', '100');
    await expect(dialog.getByText(/slug/i)).toHaveCount(0);
    // Axe with the sidebar and the Create dialog open (AC-025).
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(newProject).toBeFocused();

    // Create (Enter submits) → lands in the new workspace (AC-007, AC-015).
    await newProject.click();
    await input.fill(name);
    await input.press('Enter');
    await expect(page).toHaveURL(CUID_URL, NAVIGATION);
    projectId = new URL(page.url()).pathname.split('/').pop();
    await expect(page.getByRole('banner').getByRole('heading', { name })).toBeVisible(NAVIGATION);
    const canvas = page.locator('[data-slot="canvas-placeholder"]');
    await expect(canvas).toHaveText('Your canvas will appear here.');
    await expect(canvas).toHaveAttribute('data-role', 'owner');
    await expect(sidebarRow(page, name).getByRole('link')).toHaveAttribute('aria-current', 'page');
    await expect(sidebarRow(page, name).getByRole('link')).toHaveAttribute('href', `/editor/${projectId}`);

    // Rename from the row's actions menu (AC-008); the navbar and the row update in the same response.
    const actions = sidebarRow(page, name).getByRole('button', { name: 'Project actions' });
    await actions.click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const renameDialog = page.getByRole('dialog', { name: 'Rename project' });
    await expect(renameDialog.getByText(`Renaming "${name}".`)).toBeVisible();
    const renameInput = renameDialog.getByRole('textbox', { name: 'Project name' });
    await expect(renameInput).toBeFocused();
    await expect(renameInput).toHaveValue(name);
    expect(await renameInput.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBe(name.length);
    // Esc returns focus to the row's actions trigger (AC-024), then reopen.
    await page.keyboard.press('Escape');
    await expect(renameDialog).toBeHidden();
    await expect(actions).toBeFocused();
    await actions.click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await expect(renameInput).toBeFocused();
    await renameInput.fill(renamed);
    await renameInput.press('Enter');
    await expect(renameDialog).toBeHidden();
    await expect(page.getByRole('banner').getByRole('heading', { name: renamed })).toBeVisible({ timeout: 5_000 });
    await expect(sidebarRow(page, renamed)).toBeVisible({ timeout: 5_000 });

    // Delete the open project (AC-010): back to /editor, row gone, the URL now answers AccessDenied.
    await sidebarRow(page, renamed).getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Delete project?' });
    await expect(deleteDialog.getByText(`"${renamed}" and its canvas, members, and room will be permanently deleted. This can't be undone.`)).toBeVisible();
    await expect(deleteDialog.getByRole('textbox')).toHaveCount(0);
    await deleteDialog.getByRole('button', { name: 'Delete project' }).click();
    await expect(page).toHaveURL(/\/editor$/, NAVIGATION);
    await expect(sidebarRow(page, renamed)).toHaveCount(0, { timeout: 5_000 });

    await page.goto(`/editor/${projectId}`);
    await expect(page.getByRole('heading', { level: 1, name: DENIED })).toBeVisible(NAVIGATION);
    projectId = undefined;
  } finally {
    // Leave no project behind if an assertion failed mid-flow.
    if (projectId) await fixtures().deleteProjectById(projectId);
  }
});
