import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function seriousViolations(page: Page) {
  // `nextjs-portal` is the Next.js dev overlay, not application UI.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((n) => n.target) }));
}

test.describe('editor shell accessibility (AC-027, FR-020)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/editor');
  });

  test('axe reports no serious/critical violations with the sidebar closed and open', async ({ page }) => {
    expect(await seriousViolations(page)).toEqual([]);

    await page.getByRole('button', { name: 'Open projects sidebar' }).click();
    await expect(page.locator('#project-sidebar')).toHaveAttribute('data-state', 'open');
    await expect.poll(async () => (await page.locator('#project-sidebar').boundingBox())?.x).toBe(0);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('every button without text has an aria-label', async ({ page }) => {
    await page.getByRole('button', { name: 'Open projects sidebar' }).click();
    await expect(page.locator('#project-sidebar')).toHaveAttribute('data-state', 'open');
    const unlabelled = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((button) => !button.closest('nextjs-portal'))
        .filter((button) => (button.textContent ?? '').trim() === '' && !button.getAttribute('aria-label'))
        .map((button) => button.outerHTML.slice(0, 120)),
    );
    expect(unlabelled).toEqual([]);
  });

  test('Tab from the toggle with the sidebar open lands on the sidebar close button', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Open projects sidebar' });
    await toggle.click();
    await expect(page.locator('#project-sidebar')).toHaveAttribute('data-state', 'open');
    await page.getByRole('button', { name: 'Close projects sidebar' }).first().focus();
    await page.keyboard.press('Tab');
    const focused = page.locator('#project-sidebar [data-sidebar-close]');
    await expect(focused).toBeFocused();
  });

  test('the keyboard-focused toggle shows a visible focus ring', async ({ page }) => {
    await page.keyboard.press('Tab');
    const toggle = page.getByRole('button', { name: 'Open projects sidebar' });
    await expect(toggle).toBeFocused();
    const ring = await toggle.evaluate((el) => {
      const style = getComputedStyle(el);
      return { boxShadow: style.boxShadow, outline: style.outlineStyle };
    });
    expect(ring.boxShadow !== 'none' || ring.outline !== 'none').toBe(true);
    expect(ring.boxShadow).not.toBe('none');
  });
});
