import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';

import { USER_A_STATE, userA } from './clerk-users';

setup.describe.configure({ mode: 'serial' });

setup('clerk testing token', async () => {
  await clerkSetup();
});

// Signs user A in once (programmatically) and saves the session, so specs start authenticated. The email
// code strategy (fixed code for +clerk_test addresses) is used because the development instance applies
// Client Trust to password sign-ins from new browsers. The real form is exercised in auth.spec.ts.
setup('sign in user A', async ({ page }) => {
  const { email } = userA();
  await page.goto('/sign-in');
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: email } });
  await page.goto('/editor');
  await expect(page.getByRole('heading', { name: 'Create a project or open an existing one' })).toBeVisible();
  await expect(page.locator('.cl-userButtonTrigger')).toBeVisible();
  await page.context().storageState({ path: USER_A_STATE });
});
