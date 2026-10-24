import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { userA } from './clerk-users';
import { createProjectFor, deleteProject } from './helpers/projects';

// F15 FR-008 (AC-012, AC-013). The `?__f15_throw=` probes exist only in builds with NEXT_PUBLIC_E2E_HOOKS=1,
// which the Playwright web server always sets.

async function seriousViolations(page: Page) {
  // `nextjs-portal` is the Next.js dev overlay, not application UI.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }));
}

test('a page render error shows the root error card with its reference and never the message (AC-012)', async ({ page }) => {
  await page.goto('/editor?__f15_throw=page');
  const main = page.getByRole('main').filter({ has: page.getByRole('heading', { name: 'Something went wrong' }) });
  await expect(main).toBeVisible();
  await expect(main.getByText(/^Reference: \S+/)).toHaveClass(/font-mono/);
  await expect(main).not.toContainText('E2E boundary probe');
  await expect(main.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('a render error in the root layout falls through to global-error (AC-012, EC-007)', async ({ page }) => {
  await page.goto('/editor?__f15_throw=layout');
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/editor');
});

test.describe('workspace segment boundary (AC-013)', () => {
  let projectId: string;

  test.beforeAll(async () => {
    projectId = await createProjectFor(userA().email, 'F15 boundary probe');
  });

  test.afterAll(async () => {
    await deleteProject(projectId);
  });

  test('Tab starts at Retry with a visible focus ring, axe is clean, and Back to projects goes home', async ({ page }) => {
    await page.goto(`/editor/${projectId}?__f15_throw=segment`);
    await expect(page.getByRole('heading', { name: 'Something went wrong loading this project.' })).toBeFocused();

    await page.keyboard.press('Tab');
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeFocused();
    expect(await retry.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).boxShadow !== 'none')).toBe(true);

    expect(await seriousViolations(page)).toEqual([]);

    await page.getByRole('link', { name: 'Back to projects' }).click();
    await expect(page).toHaveURL(/\/editor$/);
  });
});

test('an unmatched URL under a project renders not-found with a link to the projects (AC-013)', async ({ page }) => {
  const response = await page.goto('/editor/not-a-cuid/anything');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/editor');
});
