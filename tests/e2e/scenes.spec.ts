import { test, expect } from '@playwright/test';

// BUG: CarpetPlot keys cells by timestamp, so repeated timestamps collide
const knownErrors: Record<string, RegExp> = {
  gaps: /Encountered two children with the same key/,
};

test('every scenes scenario renders without errors', async ({ page }) => {
  test.setTimeout(120_000);
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

      const knownError = knownErrors[id];
      if (knownError) {
        // BUG: asserts the current faulty behaviour; remove the entry once fixed
        await expect.poll(() => errors.length).toBeGreaterThan(0);
        expect(errors.filter((error) => !knownError.test(error))).toEqual([]);
      } else {
        expect(errors).toEqual([]);
      }
      errors = [];
    });
  }
});
