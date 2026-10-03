import { test, expect } from '@playwright/test';

test('every scenes scenario renders without errors', async ({ page }) => {
  let errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('/scenes.html');
  const tabs = page.getByRole('tablist').getByRole('tab');
  await expect(tabs).not.toHaveCount(0);
  const scenarioIds = await tabs.evaluateAll((elements) =>
    elements.map((tab) => tab.getAttribute('href')?.slice(1) ?? '')
  );

  for (const id of scenarioIds) {
    await test.step(id, async () => {
      await page.goto(`/scenes.html#${id}`);
      await expect(page.locator(`[role="tab"][href="#${id}"]`)).toHaveAttribute('aria-selected', 'true');
      await page.waitForSelector('.konvajs-content');
      await expect(page.getByTestId('data-testid Panel status error')).toHaveCount(0);
      expect(errors).toEqual([]);
      errors = [];
    });
  }
});
