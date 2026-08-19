import { test, expect, type Page } from "@playwright/test";

/**
 * Browser smoke: drives the REAL client+server through the paths unit tests
 * can't see — join/seat-claim, screen transitions, and "did the click do
 * anything" feedback. Full play-to-a-win is covered at the engine level by
 * tests/e2e/self-play.test.ts; here we prove the UI wiring, not the rules.
 *
 * Two pages = two players sharing one game code.
 */

async function codeFrom(page: Page): Promise<string> {
  const code = page.locator("#copy-session-btn .num");
  await expect(code).toBeVisible();
  return (await code.innerText()).trim();
}

test("battleship: two players join, deploy fleets, fire with feedback", async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();

  await alice.goto("/#/games/battleship");
  await alice.fill("#player-id", "alice");
  await alice.check("#mode-private");
  await alice.click("#create-btn");
  await expect(alice.locator("#placement-board")).toBeVisible();
  const code = await codeFrom(alice);

  await bob.goto("/#/games/battleship");
  await bob.fill("#player-id", "bob");
  await bob.fill("#session-id", code);
  await bob.click("#join-btn");
  await expect(bob.locator("#placement-board")).toBeVisible();

  for (const p of [alice, bob]) {
    await p.click("#load-template-btn");
    const submit = p.locator("#submit-setup-btn");
    await expect(submit).toBeEnabled();
    await submit.click();
  }

  // Both fleets in → play phase. First seat (alice) fires the first shot.
  const opponentCell = alice.locator('.opponent-cell[data-board="opponent"]').first();
  await expect(opponentCell).toBeVisible();
  await opponentCell.click();

  // A result banner (Hit!/Miss/Sunk) proves the shot round-tripped and rendered.
  await expect(alice.locator(".last-result")).toBeVisible();
  await alice.screenshot({ path: "test-results/battleship-play.png" });

  await alice.close();
  await bob.close();
});

test("connect4 vs computer: solo player gets instant bot replies to a finished game", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/#/games/connect4");
  await page.fill("#player-id", "tejas");
  await expect(page.locator("#mode-bot")).toBeChecked();
  await page.locator("#create-btn").dispatchEvent("click");

  await expect(page.locator("#connect4-board")).toBeVisible();
  await expect(page.locator(".c4-seats")).toContainText("Computer");

  const frameBottom = await page.locator(".connect4-board-frame").evaluate(
    (element) => element.getBoundingClientRect().bottom
  );
  expect(frameBottom).toBeLessThanOrEqual(660);

  // Drop into the first enabled column; the bot answers before the next sync,
  // so each round adds exactly two discs and it's immediately our turn again.
  for (let round = 1; round <= 3; round += 1) {
    await page.locator(".c4-drop-btn:not([disabled])").first().click();
    await expect(page.locator(".c4-disc")).toHaveCount(round * 2);
    await expect(page.locator(".status-banner.your-turn")).toBeVisible();
  }

  await page.screenshot({ path: "test-results/connect4-vs-bot.png" });
  await page.close();
});

test("labyrinth vs computer: bot takes full turns and the human is never stuck", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/#/games/labyrinth");
  await page.fill("#player-id", "tejas");
  await expect(page.locator("#mode-bot")).toBeChecked();
  const lobbyActionsBottom = await page.locator("#create-btn").evaluate(
    (element) => element.getBoundingClientRect().bottom
  );
  expect(lobbyActionsBottom).toBeLessThanOrEqual(660);
  await page.locator("#create-btn").dispatchEvent("click");

  await expect(page.locator(".labyrinth-cell").first()).toBeVisible();
  await expect(page.locator("text=Computer")).toBeVisible();

  const controlsBottom = await page.locator("#labyrinth-insert-controls").evaluate(
    (element) => element.getBoundingClientRect().bottom
  );
  expect(controlsBottom).toBeLessThanOrEqual(660);

  // Three full human turns; after each, the bot must insert+move and hand
  // the turn straight back — the UI must never sit on "waiting" for us.
  for (let round = 0; round < 3; round += 1) {
    await expect(page.locator(".status-banner.your-turn")).toBeVisible();
    await page.locator(".labyrinth-insert-btn:not([disabled])").first().click();
    await page.locator(".labyrinth-cell.reachable").first().click();
    await expect(page.locator(".status-banner.your-turn")).toBeVisible();
  }

  await page.screenshot({ path: "test-results/labyrinth-vs-bot.png" });
  await page.close();
});

test("labyrinth: two-player game is not deadlocked, insert+move passes the turn", async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();

  await alice.goto("/#/games/labyrinth");
  await alice.fill("#player-id", "alice");
  await alice.check("#mode-private");
  // Default seat count is 2 — the fix for the old hardcoded 4-seat deadlock.
  await alice.click("#create-btn");
  await expect(alice.locator(".labyrinth-insert-btn").first()).toBeVisible();
  const code = await codeFrom(alice);

  await bob.goto("/#/games/labyrinth");
  await bob.fill("#player-id", "bob");
  await bob.fill("#session-id", code);
  await bob.click("#join-btn");
  await expect(bob.locator(".labyrinth-cell").first()).toBeVisible();

  // Alice's turn: insert (an enabled arrow), then move to a reachable cell.
  await expect(alice.locator(".status-banner.your-turn")).toBeVisible();
  await alice.locator(".labyrinth-insert-btn:not([disabled])").first().click();
  await alice.locator(".labyrinth-cell.reachable").first().click();

  // Turn must pass to bob — proves the 2-player loop cycles, no deadlock.
  await expect(bob.locator(".status-banner.your-turn")).toBeVisible();
  await alice.screenshot({ path: "test-results/labyrinth-play.png" });

  await alice.close();
  await bob.close();
});

test("labyrinth mobile keeps the full maze and controls inside the viewport", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/games/labyrinth");
  await page.fill("#player-id", "tejas");
  await expect(page.locator("#mode-bot")).toBeChecked();
  await page.locator("#create-btn").dispatchEvent("click");
  await expect(page.locator("#labyrinth-board")).toBeVisible();

  const bounds = await page.locator("#labyrinth-board").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewportWidth: window.innerWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  await expect(page.locator(".labyrinth-insert-btn:not([disabled])").first()).toHaveAccessibleName(
    "Insert spare tile from top into column 2"
  );

  await page.close();
});
