import { clerkSetup } from '@clerk/testing/playwright';

/** Saved session of E2E user A, written by the setup project and used by the chromium project. */
export const USER_A_STATE = 'playwright/.auth/user-a.json';
/** Saved session of E2E user B (only when E2E_USER_B_* are set); used by the `twoUsers` fixture (F05). */
export const USER_B_STATE = 'playwright/.auth/user-b.json';

export function userA(): { email: string; password: string } {
  const email = process.env.E2E_USER_A_EMAIL;
  const password = process.env.E2E_USER_A_PASSWORD;
  if (!email || !password) {
    throw new Error('Set E2E_USER_A_EMAIL and E2E_USER_A_PASSWORD (a Clerk development-instance test user) in .env.local');
  }
  return { email, password };
}

/** E2E user B, a second Clerk development-instance test user; `null` until it is configured. */
export function userB(): { email: string; password: string } | null {
  const email = process.env.E2E_USER_B_EMAIL;
  const password = process.env.E2E_USER_B_PASSWORD;
  return email && password ? { email, password } : null;
}

/**
 * clerkSetup() stores the Frontend API host and a testing token in process.env, which is per worker:
 * call this in every worker that uses setupClerkTestingToken() (bot-protection bypass for the real form).
 */
export async function ensureClerkTesting(): Promise<void> {
  if (!process.env.CLERK_TESTING_TOKEN) await clerkSetup();
}
