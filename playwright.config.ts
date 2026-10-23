import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
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
