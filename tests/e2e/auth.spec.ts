import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { instant } from '@next/playwright';
import { expect, type Page, test } from '@playwright/test';

import { ensureClerkTesting, userA } from './clerk-users';

const EMPTY_STATE = 'Create a project or open an existing one';
const DESKTOP = { width: 1280, height: 800 };
const CLERK_TEST_CODE = '424242';
const MOBILE = { width: 390, height: 844 };

function userButton(page: Page) {
  return page.getByRole('banner').locator('.cl-userButtonTrigger');
}

function emailField(page: Page) {
  return page.locator('form input[name="identifier"], form input[name="emailAddress"]').first();
}

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/ and /editor send visitors to /sign-in (AC-007, AC-008)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto('/editor');
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(emailField(page)).toBeVisible();
  });

  test('/sign-in and /sign-up render the Clerk form in the two-panel layout (AC-004, AC-005)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    for (const path of ['/sign-in', '/sign-up']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(emailField(page)).toBeVisible();
    }

    await page.goto('/sign-in');
    const intro = page.getByRole('region', { name: 'drawArc' });
    await expect(intro).toBeVisible();
    await expect(intro.getByText('Real-time collaborative system-design canvas.')).toBeVisible();
    await expect(intro.getByRole('listitem')).toHaveCount(3);
    const introBox = await intro.boundingBox();
    const formBox = await emailField(page).boundingBox();
    expect(introBox!.x + introBox!.width).toBeLessThanOrEqual(formBox!.x);
    // Text only: no images or canvases anywhere on the page.
    await expect(page.locator('img, canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 64)).toBe(true);

    await page.setViewportSize(MOBILE);
    await expect(intro).toBeHidden();
    await expect(emailField(page)).toBeVisible();
  });

  test('signs in through the real Clerk form, then signs out via the UserButton (AC-027, AC-002)', async ({ page }) => {
    const { email, password } = userA();
    await ensureClerkTesting();
    await setupClerkTestingToken({ page });

    await page.goto('/sign-in');
    await emailField(page).fill(email);
    await page.locator('.cl-formButtonPrimary').click();
    await page.locator('input[name="password"]').fill(password);
    await page.locator('.cl-formButtonPrimary').click();
    // Client Trust (on in the development instance) asks a new browser for an email code; +clerk_test
    // addresses accept the fixed test code.
    const code = page.locator('input[autocomplete="one-time-code"]').first();
    const home = page.getByRole('heading', { name: EMPTY_STATE });
    await expect(code.or(home)).toBeVisible();
    if (await code.isVisible()) {
      // The resend countdown appears once Clerk has prepared (sent) the code; typing earlier is rejected.
      await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
      await code.pressSequentially(CLERK_TEST_CODE);
    }

    await expect(page).toHaveURL(/\/editor$/);
    await expect(page.getByRole('heading', { name: EMPTY_STATE })).toBeVisible();
    await userButton(page).click();
    // Clerk's account panel buttons expose no accessible name in 7.9; its stable element class is used.
    await page.locator('.cl-userButtonPopoverActionButton__signOut').click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe('signed in as user A', () => {
  test('/, /sign-in and /sign-up land on /editor without rendering a form (AC-006, AC-007)', async ({ page }) => {
    for (const path of ['/', '/sign-in', '/sign-up']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/editor$/);
      await expect(page.getByRole('heading', { name: EMPTY_STATE })).toBeVisible();
      await expect(page.locator('.cl-signIn-root, .cl-signUp-root')).toHaveCount(0);
    }
  });

  test('/editor renders the shell, the empty state and the UserButton with its avatar (AC-002, AC-008, AC-024b)', async ({
    page,
  }) => {
    const avatar = page.waitForResponse((res) => new URL(res.url()).hostname === 'img.clerk.com');
    const response = await page.goto('/editor');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: EMPTY_STATE })).toBeVisible();
    await expect(userButton(page)).toBeVisible();
    expect((await avatar).status()).toBe(200);
  });

  test('the skeleton is in the static shell and no secret or Clerk-internal field reaches the page (AC-009)', async ({
    page,
    baseURL,
  }) => {
    await instant(
      page,
      async () => {
        await page.goto('/editor');
        await expect(page.getByRole('banner')).toBeVisible();
        await expect(page.getByRole('banner').locator('[data-slot="user-menu-placeholder"]')).toBeVisible();
        await expect(page.getByRole('heading', { name: EMPTY_STATE })).toBeVisible();
      },
      { baseURL },
    );

    const response = await page.goto('/editor');
    await expect(userButton(page)).toBeVisible();
    const documents = [(await response?.text()) ?? '', await page.content()];
    const secret = process.env.CLERK_SECRET_KEY ?? 'unset';
    for (const html of documents) {
      expect(html).not.toContain('privateMetadata');
      expect(html).not.toContain('clerkId');
      expect(html).not.toMatch(/sk_(test|live)_/);
      expect(html).not.toContain(secret);
    }
  });
});
