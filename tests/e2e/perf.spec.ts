import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { userA } from './clerk-users';
import { expect, test } from './fixtures/two-users';
import { addMember, createProjectFor, deleteProject } from './helpers/projects';

/**
 * NFR-003 / NFR-004 envelope (F15 FR-010, AC-015 – AC-018). Runs only in the `preview` project (npm run
 * e2e:preview against a deployment); numbers from a local dev server are not evidence (EC-010). Every test
 * prints its percentiles; the preview run's output is copied to status.md with the commit hash.
 */

const fixture = JSON.parse(readFileSync('tests/fixtures/canvas/large-500-nodes.json', 'utf8')) as {
  nodes: { id: string }[];
  edges: unknown[];
};
const NODE_COUNT = fixture.nodes.length;
const NODE = '.react-flow__node';

// In order, in one worker (no parallel load skewing the numbers); a failed budget does not skip the others,
// so every run reports all four measurements.
test.describe.configure({ mode: 'default', retries: 0, timeout: 180_000 });

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN;
}

function report(name: string, values: number[]): { p50: number; p95: number; p99: number } {
  const stats = { p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99) };
  const line = `${name}: n=${values.length} p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms p99=${stats.p99.toFixed(1)}ms`;
  process.stdout.write(`[perf] ${line}\n`);
  test.info().annotations.push({ type: 'perf', description: line });
  return stats;
}

async function openSeeded(page: Page, projectId: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/editor/${projectId}`);
  await expect(page.locator(NODE)).toHaveCount(NODE_COUNT, { timeout: 60_000 });
}

/** A node fully inside the viewport, so a drag starts on it rather than on the pane. */
async function visibleNodeId(page: Page): Promise<string> {
  const id = await page.evaluate((selector) => {
    const inView = [...document.querySelectorAll<HTMLElement>(selector)].find((el) => {
      const r = el.getBoundingClientRect();
      return r.left > 300 && r.top > 120 && r.right < window.innerWidth - 300 && r.bottom < window.innerHeight - 120;
    });
    return inView?.dataset.id ?? null;
  }, NODE);
  expect(id, 'a node inside the viewport').not.toBeNull();
  return id!;
}

async function centreOf(page: Page, nodeId: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(`${NODE}[data-id="${nodeId}"]`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

let projectId: string;

// One project per worker, seeded through the snapshot API as user A; the workspace gate then seeds the room.
test.beforeAll(async ({ browser }) => {
  projectId = await createProjectFor(userA().email, 'F15 perf 500/800');
  const context = await browser.newContext({ storageState: 'playwright/.auth/user-a.json' });
  const page = await context.newPage();
  await page.goto('/editor');
  const put = await page.request.put(`/api/projects/${projectId}/canvas`, { data: { document: fixture } });
  expect(put.status(), 'snapshot seed').toBe(200);
  await context.close();
});

test.afterAll(async () => {
  if (projectId) await deleteProject(projectId);
});

test('stores the 500/800 canvas in under 5 MB (AC-018)', async ({ page }) => {
  await page.goto('/editor');
  const get = await page.request.get(`/api/projects/${projectId}/canvas`);
  expect(get.status()).toBe(200);
  const size = (await get.body()).byteLength;
  process.stdout.write(`[perf] stored canvas: ${size} bytes\n`);
  expect(size).toBeLessThan(5 * 1024 * 1024);
});

test('cold-loads the workspace to the 500th node with p95 < 3 s (AC-017)', async ({ browser }) => {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    // A fresh context per load: empty HTTP cache, same signed-in session.
    const context = await browser.newContext({ storageState: 'playwright/.auth/user-a.json' });
    const page = await context.newPage();
    await page.addInitScript(
      ({ selector, count }) => {
        const tick = () => {
          if (document.querySelectorAll(selector).length >= count) {
            (window as unknown as { __f15Loaded: number }).__f15Loaded = performance.now();
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { selector: NODE, count: NODE_COUNT },
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/editor/${projectId}`);
    const loaded = await page.waitForFunction(() => (window as unknown as { __f15Loaded?: number }).__f15Loaded, null, {
      timeout: 60_000,
    });
    samples.push((await loaded.jsonValue()) as number);
    await context.close();
  }
  expect(report('initial load (navigation start → 500th node)', samples).p95).toBeLessThan(3_000);
});

test('drags a node for 3 s with p95 frame time < 33 ms (AC-015)', async ({ page }) => {
  await openSeeded(page, projectId);
  const nodeId = await visibleNodeId(page);
  const start = await centreOf(page, nodeId);

  await page.evaluate(() => {
    const frames: number[] = [];
    const w = window as unknown as { __f15Frames: number[]; __f15Sampling: boolean };
    w.__f15Frames = frames;
    w.__f15Sampling = true;
    const tick = (t: number) => {
      frames.push(t);
      if (w.__f15Sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const STEPS = 100; // 400 px over ~3 s
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(start.x + (400 * i) / STEPS, start.y);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __f15Frames: number[]; __f15Sampling: boolean };
    w.__f15Sampling = false;
    return w.__f15Frames;
  });
  const deltas = frames.slice(1).map((t, i) => t - frames[i]!);
  expect(report('drag frame delta', deltas).p95).toBeLessThan(33);
});

test('renders a local move for the other user with p95 < 500 ms (AC-016)', async ({ twoUsers }) => {
  const { a, b, distinctUsers, emailB } = twoUsers;
  if (distinctUsers) await addMember(projectId, emailB, 'EDITOR');
  await openSeeded(a, projectId);
  await openSeeded(b, projectId);
  const nodeId = await visibleNodeId(a);

  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const from = await centreOf(a, nodeId);
    const dx = i % 2 === 0 ? 40 : -40;
    await a.mouse.move(from.x, from.y);
    await a.mouse.down();
    // Arm B's watcher before the edit; it resolves with B's clock at the first rendered position change.
    await b.evaluate((id) => {
      const w = window as unknown as { __f15Moved: Promise<number> };
      const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
      const before = el.getBoundingClientRect();
      w.__f15Moved = new Promise((resolve) => {
        // Never hang: a move that does not arrive within 5 s is recorded as 5 s (fails the budget visibly).
        setTimeout(() => resolve(Date.now()), 5_000);
        const poll = () => {
          const now = el.getBoundingClientRect();
          if (now.x !== before.x || now.y !== before.y) resolve(Date.now());
          else setTimeout(poll, 16);
        };
        poll();
      });
    }, nodeId);
    // Measured from the edit itself: drags stream positions live, so B can move before A's pointerup.
    const editedAt = Date.now();
    await a.mouse.move(from.x + dx, from.y, { steps: 2 });
    await a.mouse.up();
    const movedAt = await b.evaluate(() => (window as unknown as { __f15Moved: Promise<number> }).__f15Moved);
    samples.push(movedAt - editedAt);
    await a.waitForTimeout(250);
  }
  expect(report('local edit → remote render', samples).p95).toBeLessThan(500);
});
