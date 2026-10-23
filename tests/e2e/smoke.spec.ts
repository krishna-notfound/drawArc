import { expect, test } from '@playwright/test';

test('home responds with 200 (F00 AC-009)', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});

test('unknown route renders the not-found page with 404 (F00 AC-009)', async ({ page }) => {
  const response = await page.goto('/definitely-missing');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
