// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function loadConfig() {
  return (await import('../../../playwright.config')).default;
}

describe('playwright.config.ts (F00 AC-010)', () => {
  it('starts only the Next server by default and wires setup → chromium', async () => {
    vi.stubEnv('E2E_LIVEBLOCKS', undefined);
    const config = await loadConfig();
    expect(config.webServer).toHaveLength(1);
    expect(config.projects?.map((project) => project.name)).toEqual(['setup', 'chromium']);
    expect(config.projects?.[1]?.dependencies).toEqual(['setup']);
  });

  it('adds the Liveblocks dev server when E2E_LIVEBLOCKS=1', async () => {
    vi.stubEnv('E2E_LIVEBLOCKS', '1');
    const config = await loadConfig();
    const servers = config.webServer as { url: string }[];
    expect(servers).toHaveLength(2);
    expect(servers[1]?.url).toBe('http://localhost:1153');
  });
});
