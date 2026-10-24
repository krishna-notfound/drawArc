import AxeBuilder from '@axe-core/playwright';
import { clerk } from '@clerk/testing/playwright';
import { expect, type Page, test } from '@playwright/test';

import { ensureClerkTesting, userA } from './clerk-users';
import { fakeCuid, type Fixtures, fixtures } from './db';

// F04 page gate (FR-009–FR-011, AUTHZ-MATRIX). Projects A does not own are created directly in the
// database; the owner path (create → open → rename → delete) is driven through the UI in editor-home.spec.ts.

const NAVIGATION = { timeout: 15_000 };
const DENIED = "You can't open this project";

let db: Fixtures;
let userAId: string;
let stranger: { id: string; email: string };

test.beforeAll(async () => {
  db = fixtures();
  userAId = await db.userIdByEmail(userA().email);
  stranger = await db.createUser();
});

test.afterAll(async () => {
  await db.cleanup();
});

async function mainHtml(page: Page, path: string): Promise<string> {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1, name: DENIED })).toBeVisible(NAVIGATION);
  return main.innerHTML();
}

test('signed-in non-member, missing and malformed ids get byte-identical AccessDenied (AC-017, AC-019)', async ({
  page,
}) => {
  const foreign = await db.createProject(stranger.id, 'E2E F04 foreign');
  const pages = [await mainHtml(page, `/editor/${foreign}`), await mainHtml(page, `/editor/${fakeCuid()}`), await mainHtml(page, '/editor/not-a-cuid')];
  expect(new Set(pages).size).toBe(1);
  expect(pages[0]).not.toContain('E2E F04 foreign');
  await expect(page.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/editor');
});

test('a viewer member opens the workspace with island role viewer, without owner actions; removal locks them out (AC-018, FR-003, FR-014)', async ({
  page,
}) => {
  const name = `E2E F04 shared ${fakeCuid().slice(-6)}`;
  const shared = await db.createProject(stranger.id, name);
  await db.addMember(shared, { id: userAId, email: userA().email }, stranger.id, 'VIEWER');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/editor/${shared}`);
  await expect(page.getByRole('banner').getByRole('heading', { name })).toBeVisible(NAVIGATION);
  const canvas = page.locator('[data-slot="canvas"]');
  await expect(canvas).toHaveAttribute('data-role', 'viewer');
  await expect(canvas).toHaveAttribute('data-project-id', shared);
  // F06: a viewer opening a room nobody has edited yet gets a read-only canvas, not a crash (no Storage write).
  await expect(canvas.locator('[data-slot="flow-canvas"]')).toHaveAttribute('data-can-write', 'false', NAVIGATION);
  await expect(canvas.getByText('View only')).toBeVisible();
  // Default-open desktop sidebar; the row (if this user's cached shared list already includes it) never has
  // an actions menu — only owned rows do.
  await expect(page.locator('#project-sidebar')).toHaveAttribute('data-state', 'open');
  await expect(page.locator(`#project-sidebar li[data-project-id="${shared}"] [aria-label="Project actions"]`)).toHaveCount(0);

  await db.removeMembers(shared);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: DENIED })).toBeVisible(NAVIGATION);
});

test('an archived project opens read-only with the Archived badge (AC-021, AC-022, EC-003)', async ({ page }) => {
  const archived = await db.createProject(userAId, 'E2E F04 archived', 'ARCHIVED');
  await page.goto(`/editor/${archived}`);
  await expect(page.getByRole('banner').getByText('Archived', { exact: true })).toBeVisible(NAVIGATION);
  await expect(page.locator('[data-slot="canvas"]')).toHaveAttribute('data-role', 'viewer');
});

test('axe finds no serious/critical violations in the workspace with the AI panel open (F01 AC-027 carry-over, FR-016)', async ({
  page,
}) => {
  const name = 'E2E F04 axe';
  const project = await db.createProject(stranger.id, name);
  await db.addMember(project, { id: userAId, email: userA().email }, stranger.id, 'EDITOR');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/editor/${project}`);
  await expect(page.locator('[data-slot="canvas"]')).toHaveAttribute('data-role', 'editor', NAVIGATION);

  const toggle = page.getByRole('button', { name: 'Toggle AI sidebar' });
  await toggle.click();
  const ai = page.locator('#ai-sidebar');
  await expect(ai).toHaveAttribute('data-state', 'open');
  await expect(ai.getByText('The AI design agent arrives in a later release.')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
  expect(serious).toEqual([]);
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a visitor is sent to sign-in with the project as return URL, then lands on the gate (AC-016)', async ({ page }) => {
    const project = await db.createProject(stranger.id, 'E2E F04 return');
    await page.goto(`/editor/${project}`);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?redirect_url=${encodeURIComponent(`/editor/${project}`)}$`), NAVIGATION);

    const returnTo = new URL(page.url()).searchParams.get('redirect_url');
    expect(returnTo).toBe(`/editor/${project}`);
    await ensureClerkTesting();
    await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: userA().email } });
    await page.goto(returnTo!);
    // A is not a member of this project, so the gate (not the sign-in page) now answers.
    await expect(page.getByRole('heading', { level: 1, name: DENIED })).toBeVisible(NAVIGATION);
  });
});
