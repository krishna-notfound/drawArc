// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function loadConfig() {
  return (await import('../../../playwright.config')).default;
}

// The first import of @playwright/test is slow under a parallel suite; allow for a cold start.
describe('playwright.config.ts (F00 AC-010)', { timeout: 30_000 }, () => {
  it('starts only the Next server by default and wires setup → chromium', async () => {
    vi.stubEnv('E2E_LIVEBLOCKS', undefined);
    vi.stubEnv('E2E_BASE_URL', undefined);
    const config = await loadConfig();
    expect(config.webServer).toHaveLength(1);
    expect(config.projects?.map((project) => project.name)).toEqual(['setup', 'chromium']);
    expect(config.projects?.[1]?.dependencies).toEqual(['setup']);
  });

  // F15 FR-014: a run against a deployed preview must never start (or test) a local server.
  it('targets E2E_BASE_URL with the preview project and no local server', async () => {
    vi.stubEnv('E2E_BASE_URL', 'https://drawarc-git-feature.example.vercel.app');
    const config = await loadConfig();
    expect(config.webServer).toEqual([]);
    expect(config.use?.baseURL).toBe('https://drawarc-git-feature.example.vercel.app');
    expect(config.projects?.map((project) => project.name)).toEqual(['setup', 'preview']);
  });

  it('adds the Liveblocks dev server when E2E_LIVEBLOCKS=1', async () => {
    vi.stubEnv('E2E_LIVEBLOCKS', '1');
    const config = await loadConfig();
    const servers = config.webServer as { url: string }[];
    expect(servers).toHaveLength(2);
    expect(servers[1]?.url).toBe('http://localhost:1153');
  });
});
