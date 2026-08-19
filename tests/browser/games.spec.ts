import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { GridRenderer } from "../../packages/web-client/src/grid-renderer";

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

async function expectBattleSpritesAligned(page: Page, panel: ".own-panel" | ".opponent-panel"): Promise<void> {
  const deltas = await page.locator(`${panel} .battle-ship-sprite`).evaluateAll((sprites) => {
    return sprites.map((sprite) => {
      const panelElement = sprite.closest(".own-panel, .opponent-panel");
      if (!panelElement) throw new Error("battle_panel_missing");
      const style = getComputedStyle(sprite);
      const row = Number(style.getPropertyValue("--ship-row"));
      const col = Number(style.getPropertyValue("--ship-col"));
      const height = Number(style.getPropertyValue("--ship-height"));
      const width = Number(style.getPropertyValue("--ship-width"));
      const cells = Array.from(panelElement.querySelectorAll<HTMLElement>(".cell")).filter((cell) => {
        const cellRow = Number(cell.dataset.r);
        const cellCol = Number(cell.dataset.c);
        return cellRow >= row && cellRow < row + height && cellCol >= col && cellCol < col + width;
      });
      const spriteRect = sprite.getBoundingClientRect();
      const cellRects = cells.map((cell) => cell.getBoundingClientRect());
      return {
        left: spriteRect.left - Math.min(...cellRects.map((rect) => rect.left)),
        top: spriteRect.top - Math.min(...cellRects.map((rect) => rect.top)),
        right: spriteRect.right - Math.max(...cellRects.map((rect) => rect.right)),
        bottom: spriteRect.bottom - Math.max(...cellRects.map((rect) => rect.bottom))
      };
    });
  });

  expect(deltas.length).toBeGreaterThan(0);
  for (const delta of deltas.flatMap(Object.values)) {
    expect(Math.abs(delta)).toBeLessThan(0.1);
  }
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

  await expectBattleSpritesAligned(alice, ".own-panel");

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

test("battleship vs computer: a complete match preserves board and salvo semantics", async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto("/#/games/battleship");
  await page.fill("#player-id", "fleet-check");
  await page.locator("#create-btn").dispatchEvent("click");
  await page.click("#load-template-btn");
  await page.click("#submit-setup-btn");

  await expect(page.locator(".own-panel .cell")).toHaveCount(100);
  await expect(page.locator(".opponent-panel .cell")).toHaveCount(100);

  let salvos = 0;
  while (await page.locator("#rematch-btn").count() === 0 && salvos < 100) {
    await expect(page.locator(".status-banner.your-turn")).toBeVisible();
    await page.locator('.opponent-cell[data-board="opponent"]:not([disabled])').first().click();
    salvos += 1;
    await page.waitForFunction(() => {
      return Boolean(document.querySelector("#rematch-btn, .status-banner.your-turn"));
    });
  }

  expect(salvos).toBeLessThanOrEqual(100);
  await expect(page.locator("#rematch-btn")).toBeVisible();
  await expect(page.locator(".outgoing-salvo")).toBeVisible();
  await expect(page.locator(".incoming-salvo")).toBeVisible();
  await expect(page.locator(".error-text")).toHaveCount(0);
  await expectBattleSpritesAligned(page, ".own-panel");
  await expectBattleSpritesAligned(page, ".opponent-panel");
  await page.screenshot({ path: "test-results/battleship-complete-match.png", fullPage: true });
  await page.close();
});

test("battleship: selected ship art stays on its cells through every rotation", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("/#/games/battleship");
  await page.fill("#player-id", "alignment-check");
  await page.locator("#create-btn").dispatchEvent("click");
  await page.click('.placement-cell[data-r="4"][data-c="4"]');
  await page.click('.placement-ship[data-ship-id="carrier"]');

  const expectOverlayAligned = async (): Promise<void> => {
    const delta = await page.locator(".placement-ship.selected").evaluate((ship) => {
      const cells = [...document.querySelectorAll<HTMLElement>(".placement-cell.selected-cell")];
      const shipRect = ship.getBoundingClientRect();
      const cellRects = cells.map((cell) => cell.getBoundingClientRect());
      return {
        left: shipRect.left - Math.min(...cellRects.map((rect) => rect.left)),
        top: shipRect.top - Math.min(...cellRects.map((rect) => rect.top)),
        right: shipRect.right - Math.max(...cellRects.map((rect) => rect.right)),
        bottom: shipRect.bottom - Math.max(...cellRects.map((rect) => rect.bottom))
      };
    });

    for (const edgeDelta of Object.values(delta)) {
      expect(Math.abs(edgeDelta)).toBeLessThan(0.1);
    }
  };

  await expectOverlayAligned();
  for (let rotation = 90; rotation <= 270; rotation += 90) {
    await page.click("#rotate-btn");
    await expectOverlayAligned();
  }

  await page.close();
});

test("battleship: sunk opponent art stays on its hit coordinates", async ({ page }) => {
  const cells = [5, 6, 7, 8].map((col) => ({ row: 1, col }));
  const renderer = new GridRenderer({
    shipById: { battleship: { url: "", nativeFacing: "east" } }
  });
  const markup = renderer.render({
    ownBoard: { rows: 10, cols: 10, ships: [], hitsTaken: [] },
    opponentBoard: {
      rows: 10,
      cols: 10,
      shotsFired: cells,
      knownHits: cells,
      sunkShips: [{ shipId: "battleship", cells }]
    }
  });

  await page.setContent(`<style>${readFileSync("packages/web-client/app/app.css", "utf8")}</style>${markup}`);
  await expectBattleSpritesAligned(page, ".opponent-panel");
});

test("battleship: visual pack selection persists without changing gameplay", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/#/games/battleship");
  await page.selectOption("#asset-pack-select", "classic-vector");
  await expect(page.locator("#asset-pack-select")).toHaveValue("classic-vector");

  await page.locator("#create-btn").dispatchEvent("click");
  await expect(page.locator("#placement-board")).toBeVisible();
  await page.click("#load-template-btn");
  await expect(page.locator(".placement-ship-art").first()).toHaveAttribute(
    "src",
    /(?:\.svg$|^data:image\/svg\+xml)/
  );

  await page.close();
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

  const rotation = page.locator(".spare-rotation-readout");
  const beforeRotation = await rotation.innerText();
  await page.getByRole("button", { name: "Rotate spare tile clockwise" }).click();
  await expect(rotation).not.toHaveText(beforeRotation);
  await expect(page.locator(".status-banner.your-turn")).toBeVisible();

  const previewArrow = page.locator(".labyrinth-insert-btn:not([disabled])").first();
  await previewArrow.hover();
  await expect(page.locator(".labyrinth-cell.insertion-preview")).toHaveCount(7);
  await page.mouse.move(0, 0);

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
  await expect(page.getByRole("button", { name: "Rotate spare tile clockwise" })).toBeVisible();

  await page.close();
});
