import { test, expect, type Locator, type Page } from '@playwright/test';

async function openHarness(page: Page) {
  await page.goto('/');
  const canvas = page.locator('.konvajs-content');
  await canvas.waitFor();
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  return canvas;
}

// Spans several days, so the selection outline forms a staircase
async function dragAcrossDays(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('canvas has no bounding box');
  }
  await page.mouse.move(box.x + 100, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 250, { steps: 10 });
}

test('testdata matches snapshot', async ({ page }) => {
  const canvas = await openHarness(page);
  await expect(canvas).toHaveScreenshot('example.png');

  await canvas.hover({ position: { x: 100, y: 100 } });
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  await expect(canvas).toHaveScreenshot('example-hover.png');
});

test('drag selection matches snapshot', async ({ page }) => {
  const canvas = await openHarness(page);
  await dragAcrossDays(page, canvas);
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  await expect(canvas).toHaveScreenshot('example-drag.png');
});

test('drag selection changes the time range on release', async ({ page }) => {
  const canvas = await openHarness(page);
  await dragAcrossDays(page, canvas);
  await page.mouse.up();
  const update = page.getByText(/Time range updated: \d+ - \d+/);
  await expect(update).toBeVisible();
  const [from, to] = ((await update.textContent()) ?? '').match(/\d+/g)?.map(Number) ?? [];
  expect(from).toBeLessThan(to ?? 0);
});

test('unhatched gaps match snapshot', async ({ page }) => {
  const canvas = await openHarness(page);
  await page.getByText('hatch data gaps').click();
  await expect(canvas).toHaveScreenshot('example-unhatched.png');
});

test('bottom legend matches snapshot', async ({ page }) => {
  await openHarness(page);
  await page.getByText('show legend').click();
  await expect(page.getByTestId('data-testid viz-layout')).toHaveScreenshot('example-legend-bottom.png');
});

test('right legend matches snapshot', async ({ page }) => {
  await openHarness(page);
  await page.getByText('show legend').click();
  await page.getByRole('radio', { name: 'Right' }).click();
  await expect(page.getByTestId('data-testid viz-layout')).toHaveScreenshot('example-legend-right.png');
});

test('legend marks the hovered value', async ({ page }) => {
  const canvas = await openHarness(page);
  await page.getByText('show legend').click();
  await canvas.hover({ position: { x: 500, y: 180 } });
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  await expect(page.getByTestId('data-testid viz-layout')).toHaveScreenshot('example-legend-hover.png');
});
