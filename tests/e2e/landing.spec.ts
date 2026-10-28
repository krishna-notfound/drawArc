import AxeBuilder from '@axe-core/playwright';
import { instant } from '@next/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

import { LANDING_COPY } from '@/components/landing/copy';

const C = LANDING_COPY;
const EMPTY_STATE = 'Create a project or open an existing one';
const NAVIGATION = { timeout: 15_000 };
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];

async function seriousViolations(page: Page) {
  // `nextjs-portal` is the Next.js dev overlay, not application UI.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((n) => n.target) }));
}

const banner = (page: Page) => page.getByRole('banner');
const main = (page: Page) => page.getByRole('main');
const footer = (page: Page) => page.getByRole('contentinfo');
const ctaDuration = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).transitionDuration);

test.describe('landing, signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/ is served from the static shell with the headline and both hero CTAs (AC-002)', async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1, name: C.headline })).toBeVisible();
        await expect(main(page).getByRole('link', { name: C.cta.open })).toBeVisible();
        await expect(main(page).getByRole('link', { name: C.cta.signIn })).toBeVisible();
      },
      { baseURL },
    );
    const res = await page.request.get('/');
    expect(res.status()).toBe(200);
    expect(new URL(res.url()).pathname).toBe('/');
    expect(await res.text()).toContain(C.headline);
  });

  test('exposes one banner, nav, main and contentinfo and a single h1 followed by two h2s (AC-003)', async ({ page }) => {
    await page.goto('/');
    for (const role of ['banner', 'navigation', 'main', 'contentinfo'] as const) {
      await expect(page.getByRole(role)).toHaveCount(1);
    }
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(C.headline);
    await expect(page.getByText(C.subline)).toBeVisible();
    const tags = await page.locator('h1, h2, h3').evaluateAll((els) => els.map((e) => e.tagName));
    expect(tags.filter((t) => t === 'H2')).toHaveLength(2);
    expect(tags.slice(0, 2)).toEqual(['H1', 'H2']);
    expect(tags.filter((t) => t === 'H3')).toHaveLength(9);
  });

  test('signed-out CTAs point at /editor and /sign-in and both end on /sign-in (AC-004)', async ({ page }) => {
    await page.goto('/');
    await expect(main(page).getByRole('link', { name: C.cta.open })).toHaveAttribute('href', '/editor');
    await expect(main(page).getByRole('link', { name: C.cta.signIn })).toHaveAttribute('href', '/sign-in');
    await expect(banner(page).getByRole('link', { name: C.cta.signIn })).toHaveAttribute('href', '/sign-in');
    await expect(page.getByRole('link', { name: C.cta.projects })).toHaveCount(0);

    await main(page).getByRole('link', { name: C.cta.open }).click();
    await expect(page).toHaveURL(/\/sign-in$/, NAVIGATION);

    await page.goto('/');
    await main(page).getByRole('link', { name: C.cta.signIn }).click();
    await expect(page).toHaveURL(/\/sign-in$/, NAVIGATION);
  });

  test('renders the six feature cards, the three steps and the footer links with the shared copy (AC-006, Review Focus 4)', async ({
    page,
  }) => {
    await page.goto('/');
    for (const feature of C.features) {
      await expect(page.getByRole('heading', { level: 3, name: feature.title, exact: true })).toBeVisible();
      await expect(page.getByText(feature.body, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(C.comingSoon)).toHaveCount(1);
    await expect(
      page.locator('[data-slot="card"]', { hasText: 'AI design agent' }).getByText(C.comingSoon),
    ).toBeVisible();

    await expect(page.locator('ol > li')).toHaveCount(C.steps.length);
    for (const step of C.steps) {
      await expect(page.getByRole('heading', { level: 3, name: step.title, exact: true })).toBeVisible();
      await expect(page.getByText(step.body, { exact: true })).toBeVisible();
    }

    const github = footer(page).getByRole('link', { name: C.footer.github, exact: true });
    await expect(github).toHaveAttribute('href', C.footer.githubHref);
    await expect(github).toHaveAttribute('target', '_blank');
    await expect(github).toHaveAttribute('rel', /noopener/);
    await expect(github).toHaveAttribute('rel', /noreferrer/);
    await expect(footer(page).getByRole('link', { name: C.footer.signIn })).toHaveAttribute('href', '/sign-in');

    // Scoped to the landmarks so the `nextjs-portal` dev overlay's own icons are ignored.
    for (const region of [banner(page), main(page), footer(page)]) {
      await expect(region.locator('svg[tabindex], svg:not([aria-hidden="true"])')).toHaveCount(0);
    }
  });

  test('is axe-clean at 320, 375 and 1280 px with no horizontal scroll (AC-011, Review Focus 5)', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      expect(await seriousViolations(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBe(true);
    }
  });

  test('Tab order runs wordmark, header CTA, hero primary, hero secondary, GitHub, footer Sign in with a visible ring (AC-011)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await banner(page).getByRole('link', { name: C.wordmark }).focus();
    const order = [
      banner(page).getByRole('link', { name: C.cta.signIn }),
      main(page).getByRole('link', { name: C.cta.open }),
      main(page).getByRole('link', { name: C.cta.signIn }),
      footer(page).getByRole('link', { name: C.footer.github, exact: true }),
      footer(page).getByRole('link', { name: C.footer.signIn }),
    ];
    for (const [index, link] of order.entries()) {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      if (index === 1) {
        const ring = await link.evaluate((el) => {
          const style = getComputedStyle(el);
          return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle };
        });
        expect(ring.boxShadow !== 'none' || ring.outlineStyle !== 'none').toBe(true);
      }
    }
  });

  test('reduced motion zeroes the transition duration on every CTA (AC-012, Review Focus 5)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (const link of [
      main(page).getByRole('link', { name: C.cta.open }),
      main(page).getByRole('link', { name: C.cta.signIn }),
      banner(page).getByRole('link', { name: C.cta.signIn }),
    ]) {
      expect(await ctaDuration(link)).toBe('0s');
    }
  });
});

test.describe('landing, signed in as user A', () => {
  test('/ does not redirect and swaps the CTA to "Go to your projects" without resizing or hydration errors (AC-005, EC-008, Review Focus 1)', async ({
    page,
    browser,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    // A request carrying user A's cookies still receives the static signed-out HTML (the page is not per-session).
    const raw = await (await page.request.get('/')).text();
    expect(raw).toContain(C.cta.open);
    expect(raw).not.toContain(C.cta.projects);

    // Pre-swap geometry comes from a signed-out render of the same static HTML.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 800 },
    });
    const reference = await context.newPage();
    await reference.goto('/');
    const before = await main(reference).getByRole('link', { name: C.cta.open }).boundingBox();
    await context.close();

    await page.goto('/');
    expect(new URL(page.url()).pathname).toBe('/');
    const projects = main(page).getByRole('link', { name: C.cta.projects });
    await expect(projects).toBeVisible({ timeout: 10_000 });
    await expect(projects).toHaveAttribute('href', '/editor');
    await expect(banner(page).getByRole('link', { name: C.cta.projects })).toBeVisible();
    await expect(main(page).getByRole('link', { name: C.cta.signIn })).toHaveCount(0);
    await expect(banner(page).getByRole('link', { name: C.cta.signIn })).toHaveCount(0);

    const after = await projects.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);

    await projects.click();
    await expect(page).toHaveURL(/\/editor$/, NAVIGATION);
    await expect(page.getByRole('heading', { level: 1, name: EMPTY_STATE })).toBeVisible();
  });
});
