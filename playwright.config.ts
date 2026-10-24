import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Test workers need E2E_USER_* and the Clerk keys (clerkSetup); the dev server reads .env.local itself.
config({ path: ['.env.local', '.env'], quiet: true });

const isCI = Boolean(process.env.CI);
// Parallel feature worktrees each run their own dev server: E2E_PORT and E2E_WORKERS keep them apart.
const port = Number(process.env.E2E_PORT ?? 3000);
const workers = Number(process.env.E2E_WORKERS ?? 4);
const liveblocksDevServer = process.env.E2E_LIVEBLOCKS === '1';
const LIVEBLOCKS_DEV_URL = 'http://localhost:1153';

// The app under test always exposes the test-only room page; with E2E_LIVEBLOCKS=1 it also talks to the local
// Liveblocks dev server (which accepts only `sk_localdev`) instead of the project in LIVEBLOCKS_SECRET_KEY (F05).
const appEnv: Record<string, string> = {
  NEXT_PUBLIC_E2E_HOOKS: '1',
  ...(liveblocksDevServer
    ? {
        LIVEBLOCKS_SECRET_KEY: 'sk_localdev',
        NEXT_PUBLIC_LIVEBLOCKS_BASE_URL: LIVEBLOCKS_DEV_URL,
      }
    : {}),
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Every context round-trips to the Clerk development instance (handshake, Frontend API); with one worker per
  // core a cold dev server plus Clerk's throttling timed out page loads, so parallelism is capped.
  workers,
  retries: isCI ? 2 : 0,
  reporter: isCI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'on-first-retry' },
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
      command: isCI ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: appEnv,
    },
    // Liveblocks local dev server for multi-user tests (E2E_LIVEBLOCKS=1). The CLI needs the Bun runtime, so it is
    // fetched with npx rather than required globally. CLI 1.9.0 fails to open room storage on Windows paths.
    ...(liveblocksDevServer
      ? [
          {
            command: 'npx --yes -p bun@1.4.4 -c "bun x --bun liveblocks@1.9.0 dev --no-persist --no-check --port 1153"',
            url: LIVEBLOCKS_DEV_URL,
            reuseExistingServer: !isCI,
          },
        ]
      : []),
  ],
});
