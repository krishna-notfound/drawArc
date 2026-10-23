import { instant } from '@next/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

function sidebar(page: Page): Locator {
  return page.locator('#project-sidebar');
}

async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
}

async function expectClosed(page: Page) {
  const panel = sidebar(page);
  await expect(panel).toHaveAttribute('data-state', 'closed');
  await expect.poll(() => computed(panel, 'visibility')).toBe('hidden');
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(0);
  expect(await computed(panel, 'position')).toBe('fixed');
  expect(await computed(panel, 'box-shadow')).toBe('none');
}

async function expectOpen(page: Page) {
  const panel = sidebar(page);
  await expect(panel).toHaveAttribute('data-state', 'open');
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(0);
  expect(await computed(panel, 'visibility')).toBe('visible');
}

async function toggle(page: Page) {
  await page.getByRole('button', { name: /projects sidebar/ }).first().click();
}

test.describe('editor shell (F01)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test('root layout metadata, fonts and body tokens (AC-008, AC-002b)', async ({ page }) => {
    await page.goto('/editor');
    await expect(page).toHaveTitle('drawArc');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Real-time collaborative system-design canvas.',
    );
    const html = page.locator('html');
    expect(await computed(html, '--font-geist-sans')).not.toBe('');
    expect(await computed(html, '--font-geist-mono')).not.toBe('');
    await expect(html).toHaveClass(/\bh-full\b/);
    await expect(html).toHaveClass(/\bantialiased\b/);
    const body = page.locator('body');
    for (const cls of ['bg-base', 'text-copy-primary', 'font-sans', 'min-h-full', 'flex', 'flex-col']) {
      await expect(body).toHaveClass(new RegExp(`(^|\\s)${cls}(\\s|$)`));
    }
    expect(await computed(body, 'background-color')).toBe('rgb(8, 8, 9)');
  });

  test('sidebar is fully off-screen when closed and slides in over content (AC-010, AC-011)', async ({ page }) => {
    await page.goto('/editor');
    await expectClosed(page);

    const main = page.locator('main');
    const mainBefore = await main.boundingBox();
    const scrollBefore = await main.evaluate((el) => el.scrollWidth);

    await toggle(page);
    await expectOpen(page);

    expect(await main.boundingBox()).toEqual(mainBefore);
    expect(await main.evaluate((el) => el.scrollWidth)).toBe(scrollBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBe(true);

    await toggle(page);
    await expectClosed(page);
  });

  test('closed sidebar is not reachable by Tab (AC-012, inert)', async ({ page }) => {
    await page.goto('/editor');
    await expectClosed(page);
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const insidePanel = await page.evaluate(
        () => document.getElementById('project-sidebar')?.contains(document.activeElement) ?? false,
      );
      expect(insidePanel).toBe(false);
    }
  });

  test('Escape closes the open sidebar and returns focus to the toggle (AC-013, AC-014)', async ({ page }) => {
    await page.goto('/editor');
    await toggle(page);
    await expectOpen(page);
    await expect(page.getByRole('button', { name: 'Close projects sidebar' }).last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expectClosed(page);
    await expect(page.getByRole('button', { name: 'Open projects sidebar' })).toBeFocused();
  });

  test('mobile scrim closes the sidebar; desktop has none; resize keeps it open (AC-015)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/editor');
    await toggle(page);
    await expectOpen(page);
    const scrim = page.locator('[data-scrim]');
    await expect(scrim).toBeVisible();
    await page.mouse.click(380, 500);
    await expectClosed(page);

    await page.setViewportSize(DESKTOP);
    await toggle(page);
    await expectOpen(page);
    await expect(scrim).toBeHidden();
    await toggle(page);
    await expectClosed(page);

    await page.setViewportSize(MOBILE);
    await toggle(page);
    await expectOpen(page);
    await page.setViewportSize(DESKTOP);
    await expect(sidebar(page)).toHaveAttribute('data-state', 'open');
    await expect(scrim).toBeHidden();
    expect((await page.locator('main').boundingBox())?.width).toBe(DESKTOP.width);
  });

  test('transitions run at 200ms with motion (AC-016)', async ({ page }) => {
    await page.goto('/editor');
    expect(await computed(sidebar(page), 'transition-duration')).toMatch(/^0\.2s(,|$)/);
  });

  test('reduced motion disables the transition with identical end states (AC-016)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/editor');
    expect(await computed(sidebar(page), 'transition-duration')).toBe('0s');
    await expectClosed(page);
    await toggle(page);
    await expectOpen(page);
    await toggle(page);
    await expectClosed(page);
  });

  test('chrome icons render at the h-5 w-5 button size (AC-007)', async ({ page }) => {
    await page.goto('/editor');
    const icon = page.getByRole('button', { name: 'Open projects sidebar' }).locator('svg');
    const box = await icon.boundingBox();
    expect(box?.width).toBe(20);
    expect(box?.height).toBe(20);
  });

  test('editor-home empty state is in the static shell (AC-023)', async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto('/editor');
        await expect(page.getByRole('banner')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Create a project or open an existing one' })).toBeVisible();
        await expect(
          page.getByText('Start a new architecture workspace, or choose a project from the sidebar.'),
        ).toBeVisible();
        const icon = page.locator('main [data-slot="empty-state"] svg').first();
        await expect(icon).toHaveClass(/\bh-8\b/);
        await expect(icon).toHaveClass(/\bw-8\b/);
      },
      { baseURL },
    );
  });
});
