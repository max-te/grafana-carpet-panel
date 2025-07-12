import {test, expect} from "@playwright/test";

test("testdata matches snapshot", async ({page}) => {
    await page.goto("/");
    await page.waitForSelector(".konvajs-content");
    await expect(page.locator(".konvajs-content")).toHaveScreenshot("example.png");

    await page.locator(".konvajs-content").hover({ position: { x: 100, y: 100 } })
    await page.getByTestId("SeriesTableRow").waitFor({ state: "visible" });
    await expect(page.locator(".konvajs-content")).toHaveScreenshot("example-hover.png");
})
