import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Test workers need E2E_USER_* and the Clerk keys (clerkSetup); the dev server reads .env.local itself.
config({ path: ['.env.local', '.env'], quiet: true });

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    // Specs run signed in as E2E user A unless they reset storageState (see tests/e2e/auth.spec.ts).
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user-a.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: isCI ? 'npm run start' : 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    // Liveblocks local dev server for multi-user tests; F05 turns this on with E2E_LIVEBLOCKS=1.
    ...(process.env.E2E_LIVEBLOCKS === '1'
      ? [
          {
            command: 'npx liveblocks dev --no-persist --no-check --port 1153',
            url: 'http://localhost:1153',
            reuseExistingServer: !isCI,
          },
        ]
      : []),
  ],
});
