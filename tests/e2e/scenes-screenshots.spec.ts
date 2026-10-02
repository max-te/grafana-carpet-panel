import { test, expect, type Page } from '@playwright/test';

const scenarioIds = [
  'options',
  'crosshair',
  'shared-tooltip',
  'resolution',
  'gaps',
  'values',
  'fields',
  'timezones',
  'dst',
  'sizes',
  'categorical',
  'legend',
  'thresholds',
];

// Scenes default to the browser time zone, and some ranges are relative to now
test.use({ timezoneId: 'Europe/Berlin', viewport: { width: 1600, height: 1000 } });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2025-06-16T12:00:00+02:00'));
});

test('screenshots cover every scenario', async ({ page }) => {
  await page.goto('/scenes.html');
  const tabs = page.getByRole('tablist').getByRole('tab');
  await expect(tabs).not.toHaveCount(0);
  const tabIds = await tabs.evaluateAll((elements) => elements.map((tab) => tab.getAttribute('href')?.slice(1) ?? ''));
  expect(tabIds).toEqual(scenarioIds);
});

async function expectSceneScreenshot(page: Page, name: string, scale: 'css' | 'device' = 'css') {
  await page.waitForSelector('.konvajs-content');
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await page.mouse.move(0, 0);
  await expect(page.getByTestId('scenario')).toHaveScreenshot(name, { scale });
}

for (const id of scenarioIds) {
  test(`scenario ${id} matches snapshot`, async ({ page }) => {
    await page.goto(`/scenes.html#${id}`);
    await expectSceneScreenshot(page, `scenes-${id}.png`);
  });
}

async function hoverFirstPanel(page: Page) {
  const canvas = page.locator('.konvajs-content').first();
  await canvas.waitFor();
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await canvas.hover({ position: { x: 200, y: 150 } });
}

test('shared tooltip shows in every synced panel', async ({ page }) => {
  await page.goto('/scenes.html#shared-tooltip');
  await hoverFirstPanel(page);
  await expect(page.getByTestId('data-testid viz-tooltip-wrapper')).toHaveCount(3);
  await expect(page.getByTestId('scenario')).toHaveScreenshot('scenes-shared-tooltip-hover.png');
});

test('scrolling hides the tooltip until the next hover', async ({ page }) => {
  await page.goto('/scenes.html#timezones');
  await hoverFirstPanel(page);
  const tooltips = page.getByTestId('data-testid viz-tooltip-wrapper');
  await expect(tooltips).toHaveCount(1);
  await page.evaluate(() => {
    window.scrollBy(0, 50);
  });
  await expect(tooltips).toHaveCount(0);
  await page
    .locator('.konvajs-content')
    .first()
    .hover({ position: { x: 201, y: 151 } });
  await expect(tooltips).toHaveCount(1);
});

test('scrolling hides shared tooltips', async ({ page }) => {
  await page.goto('/scenes.html#shared-tooltip');
  await hoverFirstPanel(page);
  const tooltips = page.getByTestId('data-testid viz-tooltip-wrapper');
  await expect(tooltips).toHaveCount(3);
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(tooltips).toHaveCount(0);
  await page
    .locator('.konvajs-content')
    .first()
    .hover({ position: { x: 201, y: 151 } });
  await expect(tooltips).toHaveCount(3);
});

test('resizing the window hides tooltips until the next hover', async ({ page }) => {
  await page.goto('/scenes.html#shared-tooltip');
  await hoverFirstPanel(page);
  const tooltips = page.getByTestId('data-testid viz-tooltip-wrapper');
  await expect(tooltips).toHaveCount(3);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await expect(tooltips).toHaveCount(0);
  await page
    .locator('.konvajs-content')
    .first()
    .hover({ position: { x: 201, y: 151 } });
  await expect(tooltips).toHaveCount(3);
});

test('hovering categorical cells shows their tooltip', async ({ page }) => {
  await page.goto('/scenes.html#categorical');
  const canvases = page.locator('.konvajs-content');
  await expect(canvases).toHaveCount(4);
  for (const canvas of await canvases.all()) {
    await canvas.hover({ position: { x: 200, y: 150 } });
    await expect(page.getByTestId('data-testid viz-tooltip-wrapper')).toHaveCount(1);
  }
});

test('crosshair sync shows only the local tooltip', async ({ page }) => {
  await page.goto('/scenes.html#crosshair');
  await hoverFirstPanel(page);
  await expect(page.getByTestId('data-testid viz-tooltip-wrapper')).toHaveCount(1);
});

test('scenario options in dark theme matches snapshot', async ({ page }) => {
  await page.goto('/scenes.html#options');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expectSceneScreenshot(page, 'scenes-options-dark.png');
});

test.describe('at fractional device pixel ratio', () => {
  test.use({ deviceScaleFactor: 1.25 });

  test('scenario options matches snapshot', async ({ page }) => {
    await page.goto('/scenes.html#options');
    await expectSceneScreenshot(page, 'scenes-options-dpr1.25.png', 'device');
  });
});
