import { expect, test, type Page } from "@playwright/test";

function guardPage(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request:${request.url()}`));
  return errors;
}

async function silenceExternalAnalytics(page: Page): Promise<void> {
  await page.route("**/*cloudflareinsights.com/**", (route) => route.fulfill({
    status: 204,
    body: ""
  }));
}

test("Hex Kingdoms vs computer reaches final scoring through the visible UI", async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = guardPage(page);
  await silenceExternalAnalytics(page);

  await page.goto("/#/games/hex-kingdoms");
  await page.fill("#player-id", "hex-pilot");
  await page.locator("#create-btn").dispatchEvent("click");

  await expect(page.locator(".hex-board")).toBeVisible();
  await expect(page.locator(".hk-market-card")).toHaveCount(4);
  await expect(page.getByText("Computer", { exact: false })).toBeVisible();

  let humanTurns = 0;
  while (await page.getByRole("button", { name: "Play Again" }).count() === 0 && humanTurns < 10) {
    const market = page.locator(".hk-market-card:not([disabled])").first();
    await expect(market).toBeVisible();
    await market.click();
    const frontier = page.locator(".hex-board__cell.is-legal:not([disabled])").first();
    await expect(frontier).toBeVisible();
    await frontier.click();
    humanTurns += 1;
    await page.waitForFunction(() => (
      Boolean(document.querySelector(".hk-market-card:not([disabled]), .hk-terminal"))
    ));
  }

  expect(humanTurns).toBe(10);
  await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();
  await expect(page.locator(".hex-board__cell.is-tile")).toHaveCount(20);
  await expect(page.locator(".hk-score-row")).toHaveCount(2);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/hex-kingdoms-terminal.png", fullPage: true });
  await page.close();
});

test("Hex Kingdoms remains usable without horizontal overflow on phone", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = guardPage(page);
  await silenceExternalAnalytics(page);

  await page.goto("/#/games/hex-kingdoms");
  await page.fill("#player-id", "mobile-pilot");
  await page.locator("#create-btn").dispatchEvent("click");
  await expect(page.locator(".hex-board")).toBeVisible();

  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".hk-market-card")).toHaveCount(4);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/hex-kingdoms-mobile.png", fullPage: true });
  await page.close();
});
