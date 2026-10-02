import { test, expect } from '@playwright/test';

test('testdata matches snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.konvajs-content');
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await expect(page.locator('.konvajs-content')).toHaveScreenshot('example.png');

  await page.locator('.konvajs-content').hover({ position: { x: 100, y: 100 } });
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  await expect(page.locator('.konvajs-content')).toHaveScreenshot('example-hover.png');
});

test('drag selection matches snapshot', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.konvajs-content');
  await canvas.waitFor();
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('canvas has no bounding box');
  }

  // Spans several days, so the selection outline forms a staircase
  await page.mouse.move(box.x + 100, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 250, { steps: 10 });
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  await expect(canvas).toHaveScreenshot('example-drag.png');
});

test('unhatched gaps match snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.konvajs-content');
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await page.getByText('hatch data gaps').click();
  await expect(page.locator('.konvajs-content')).toHaveScreenshot('example-unhatched.png');
});

test('bottom legend matches snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.konvajs-content');
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await page.getByText('show legend').click();
  await expect(page.getByTestId('data-testid viz-layout')).toHaveScreenshot('example-legend-bottom.png');
});

test('right legend matches snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.konvajs-content');
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await page.getByText('show legend').click();
  await page.getByRole('radio', { name: 'Right' }).click();
  await expect(page.getByTestId('data-testid viz-layout')).toHaveScreenshot('example-legend-right.png');
});
