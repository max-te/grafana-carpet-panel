import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Europe/Berlin', viewport: { width: 640, height: 1000 }, deviceScaleFactor: 2 });

test('readme screenshot matches snapshot', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2025-06-16T12:00:00+02:00'));
  await page.goto('/scenes.html#readme');
  await page.getByRole('radio', { name: 'Dark' }).check();
  const panel = page.getByTestId('data-testid Panel header Energy consumption');
  const canvas = panel.locator('.konvajs-content');
  await canvas.waitFor();
  await page.evaluate(async () => await document.fonts.load('12px Inter'));
  await canvas.hover({ position: { x: 240, y: 120 } });
  await page.getByTestId('data-testid viz-tooltip-wrapper').waitFor({ state: 'visible' });
  // Leaves the panel's rounded corners transparent
  await page.addStyleTag({ content: 'html, body { background: transparent !important; }' });
  await expect(panel).toHaveScreenshot('readme.png', { omitBackground: true, scale: 'device' });
});
