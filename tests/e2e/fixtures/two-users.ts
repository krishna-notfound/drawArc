import { existsSync } from 'node:fs';

import { test as base, type Page } from '@playwright/test';

import { USER_A_STATE, USER_B_STATE, userA, userB } from '../clerk-users';

export interface TwoUsers {
  a: Page;
  b: Page;
  /** False when E2E user B is not configured: `b` is then a second session of user A. */
  distinctUsers: boolean;
  emailA: string;
  emailB: string;
}

/** Two independent browser contexts, each with its own Clerk session (F05 FR-017). */
export const test = base.extend<{ twoUsers: TwoUsers }>({
  // `provide` is Playwright's fixture callback (named so the React hooks lint rule does not mistake it for `use`).
  twoUsers: async ({ browser }, provide) => {
    const b = userB();
    const distinctUsers = b !== null && existsSync(USER_B_STATE);
    const contextA = await browser.newContext({ storageState: USER_A_STATE });
    const contextB = await browser.newContext({ storageState: distinctUsers ? USER_B_STATE : USER_A_STATE });
    await provide({
      a: await contextA.newPage(),
      b: await contextB.newPage(),
      distinctUsers,
      emailA: userA().email,
      emailB: b && distinctUsers ? b.email : userA().email,
    });
    await contextA.close();
    await contextB.close();
  },
});

export { expect } from '@playwright/test';
