import { expect, test, type Locator, type Page } from "@playwright/test";

const CHANNELS = ["Azure Triangle", "Amber Circle", "Magenta Square", "Jade Diamond"] as const;

type PacketKnowledge = {
  locator: Locator;
  channels: string[];
  ranks: number[];
};

type OpenSocket = {
  locator: Locator;
  channel: string;
  rank: number;
};

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

async function startSoloMission(page: Page, playerName: string): Promise<void> {
  await page.goto("/#/games/signal-crew");
  await page.fill("#player-id", playerName);
  await expect(page.locator("#human-seats")).toHaveValue("1");
  await expect(page.locator("#bot-seats")).toHaveValue("1");
  await page.locator("#create-btn").dispatchEvent("click");
  await expect(page.locator(".signal-crew-screen")).toBeVisible();
  await expect(page.locator(".sc-relay")).toHaveCount(5);
  await expect(page.locator(".sc-crew-hand header strong", { hasText: "Computer" })).toBeVisible();
}

function parsePacketKnowledge(label: string): Omit<PacketKnowledge, "locator"> {
  const channels = CHANNELS.filter((channel) => label.includes(channel));
  const ranksText = label.match(/possible ranks ([\d, ]+)/)?.[1] ?? "";
  const ranks = ranksText.split(",").map(Number).filter(Number.isFinite);
  return { channels, ranks };
}

async function ownPacketKnowledge(page: Page): Promise<PacketKnowledge[]> {
  const packets = page.locator(".sc-own-station .sc-packet-own");
  return Promise.all(Array.from({ length: await packets.count() }, async (_, index) => {
    const locator = packets.nth(index);
    const label = await locator.getAttribute("aria-label") ?? "";
    return { locator, ...parsePacketKnowledge(label) };
  }));
}

async function assertOwnHandConcealed(page: Page): Promise<void> {
  await expect(page.locator(".sc-own-station .sc-packet-face")).toHaveCount(0);
  const exposed = await page.locator(".sc-own-station .sc-packet-own").evaluateAll((packets) => packets.some((packet) => (
    !packet.getAttribute("aria-label")?.startsWith("Unknown packet;") ||
    /sc-packet--(?:azure|amber|magenta|jade)/.test(packet.className)
  )));
  expect(exposed).toBe(false);
}

async function openSockets(page: Page): Promise<OpenSocket[]> {
  const sockets = page.locator('.sc-socket[aria-label$="empty"]');
  return Promise.all(Array.from({ length: await sockets.count() }, async (_, index) => {
    const locator = sockets.nth(index);
    const label = await locator.getAttribute("aria-label") ?? "";
    const channel = CHANNELS.find((candidate) => label.includes(candidate)) ?? "";
    const rank = Number(label.match(/rank (\d)/)?.[1]);
    return { locator, channel, rank };
  }));
}

function confidence(packet: PacketKnowledge, socket: OpenSocket): number {
  if (!packet.channels.includes(socket.channel) || !packet.ranks.includes(socket.rank)) return 0;
  return 1 / (packet.channels.length * packet.ranks.length);
}

async function waitForTurnResolution(page: Page, previousSequence: string): Promise<void> {
  await page.waitForFunction((sequence) => {
    const terminal = document.querySelector(".sc-terminal");
    const current = document.querySelector(".sc-sequence")?.textContent?.trim();
    return Boolean(terminal) || (Boolean(current) && current !== sequence);
  }, previousSequence);
  await page.waitForFunction(() => (
    Boolean(document.querySelector(".sc-terminal")) ||
    Boolean(document.querySelector('.sc-turn-status.is-active'))
  ));
}

async function submitAction(page: Page, action: () => Promise<void>): Promise<void> {
  const previousSequence = (await page.locator(".sc-sequence").textContent())?.trim() ?? "";
  await action();
  await waitForTurnResolution(page, previousSequence);
}

async function playHumanTurn(page: Page): Promise<"clue" | "transmit" | "recycle" | "stand"> {
  const packets = await ownPacketKnowledge(page);
  const sockets = await openSockets(page);
  const certainMatch = packets.flatMap((packet) => sockets
    .filter((socket) => confidence(packet, socket) === 1)
    .map((socket) => ({ packet, socket }))
  )[0];

  if (certainMatch) {
    await page.getByRole("button", { name: "Transmit", exact: true }).click();
    await certainMatch.packet.locator.click();
    await certainMatch.socket.locator.click();
    await submitAction(page, () => page.getByRole("button", { name: "Transmit packet" }).click());
    return "transmit";
  }

  const clueTab = page.getByRole("button", { name: "Give clue" });
  if (await clueTab.isEnabled()) {
    await clueTab.click();
    const clue = page.locator(".sc-clue-grid button").first();
    if (await clue.count()) {
      await clue.click();
      await submitAction(page, () => page.getByRole("button", { name: /Send clue/ }).click());
      return "clue";
    }
  }

  const safeRecycle = packets.find((packet) => sockets.every((socket) => confidence(packet, socket) === 0));
  const recycleTab = page.getByRole("button", { name: "Recycle", exact: true });
  if (safeRecycle && await recycleTab.isEnabled()) {
    await recycleTab.click();
    await safeRecycle.locator.click();
    await submitAction(page, () => page.getByRole("button", { name: /Reveal & recycle/ }).click());
    return "recycle";
  }

  const guesses = packets.flatMap((packet) => sockets.map((socket) => ({
    packet,
    socket,
    confidence: confidence(packet, socket)
  }))).filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);
  const guess = guesses[0];
  const transmitTab = page.getByRole("button", { name: "Transmit", exact: true });
  if (guess && await transmitTab.isEnabled()) {
    await transmitTab.click();
    await guess.packet.locator.click();
    await guess.socket.locator.click();
    await submitAction(page, () => page.getByRole("button", { name: "Transmit packet" }).click());
    return "transmit";
  }

  if (packets[0] && await recycleTab.isEnabled()) {
    await recycleTab.click();
    await packets[0].locator.click();
    await submitAction(page, () => page.getByRole("button", { name: /Reveal & recycle/ }).click());
    return "recycle";
  }

  await submitAction(page, () => page.getByRole("button", { name: /Stand by/ }).click());
  return "stand";
}

test("Signal Crew and its computer crewmate complete a mission through the visible UI", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = guardPage(page);
  await silenceExternalAnalytics(page);
  await startSoloMission(page, "signal-pilot");

  await expect(page.locator(".sc-own-station .sc-packet-own")).toHaveCount(5);
  await expect(page.locator(".sc-crew-hand .sc-packet-face")).toHaveCount(5);
  await assertOwnHandConcealed(page);
  for (const packet of await ownPacketKnowledge(page)) {
    await expect(packet.locator).toHaveAttribute("aria-label", /^Unknown packet; possible channels .+; possible ranks /);
    await expect(packet.locator).not.toHaveClass(/sc-packet--(?:azure|amber|magenta|jade)/);
  }

  const actions = new Set<string>();
  let humanTurns = 0;
  while (await page.locator(".sc-terminal").count() === 0 && humanTurns < 60) {
    await expect(page.locator(".sc-turn-status.is-active")).toBeVisible();
    await assertOwnHandConcealed(page);
    actions.add(await playHumanTurn(page));
    humanTurns += 1;
  }

  expect(humanTurns).toBeLessThan(60);
  expect(actions.size).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".sc-terminal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();
  await expect(page.locator(".sc-track")).toHaveCount(3);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/signal-crew-terminal.png", fullPage: true });
  await page.close();
});

test("Signal Crew remains usable and private on a phone viewport", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = guardPage(page);
  await silenceExternalAnalytics(page);
  await startSoloMission(page, "mobile-signal-pilot");

  const rootOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(rootOverflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".sc-relay-rack")).toHaveCSS("overflow-x", "auto");
  await page.locator(".sc-action-dock").scrollIntoViewIfNeeded();
  await expect(page.locator(".sc-action-dock")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Give clue" })).toBeVisible();
  await assertOwnHandConcealed(page);
  await expect(page.locator(".sc-own-station .sc-packet-back")).toHaveCount(5);

  await page.getByRole("button", { name: "Give clue" }).click();
  await expect(page.locator(".sc-clue-grid button").first()).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/signal-crew-mobile.png", fullPage: true });
  await page.close();
});

test("two human crew members receive private views and realtime turn updates", async ({ browser }) => {
  const creator = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const joiner = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const creatorErrors = guardPage(creator);
  const joinerErrors = guardPage(joiner);
  await silenceExternalAnalytics(creator);
  await silenceExternalAnalytics(joiner);

  await creator.goto("/#/games/signal-crew");
  await creator.fill("#player-id", "relay-one");
  await creator.selectOption("#human-seats", "2");
  await creator.selectOption("#bot-seats", "0");
  await creator.locator("#create-btn").dispatchEvent("click");
  await expect(creator.locator(".signal-crew-screen")).toBeVisible();
  await expect(creator.locator(".sc-turn-status")).toContainText("Waiting for 1 more crew member");
  await expect(creator.getByRole("button", { name: "Give clue" })).toBeDisabled();

  const codeLabel = await creator.locator('button[aria-label^="Copy game code"]').getAttribute("aria-label") ?? "";
  const sessionCode = codeLabel.match(/Copy game code (.+)$/)?.[1];
  expect(sessionCode).toBeTruthy();

  await joiner.goto("/#/games/signal-crew");
  await joiner.fill("#session-id", sessionCode!);
  await joiner.fill("#player-id", "relay-two");
  await joiner.locator("#join-btn").dispatchEvent("click");

  await expect(creator.locator(".sc-relay")).toHaveCount(5);
  await expect(joiner.locator(".sc-relay")).toHaveCount(5);
  await expect(creator.locator(".sc-turn-status")).not.toContainText("Waiting for 1 more crew member");
  await expect(joiner.locator(".sc-turn-status")).not.toContainText("Waiting for 1 more crew member");

  for (const page of [creator, joiner]) {
    await expect(page.locator(".sc-own-station .sc-packet-back")).toHaveCount(5);
    await expect(page.locator(".sc-crew-hand .sc-packet-face")).toHaveCount(5);
    await assertOwnHandConcealed(page);
  }
  await expect(creator.locator(".sc-own-station")).toContainText("relay-one");
  await expect(creator.locator(".sc-crew-hand")).toContainText("relay-two");
  await expect(joiner.locator(".sc-own-station")).toContainText("relay-two");
  await expect(joiner.locator(".sc-crew-hand")).toContainText("relay-one");

  await expect.poll(async () => (
    await creator.locator(".sc-turn-status.is-active").count() +
    await joiner.locator(".sc-turn-status.is-active").count()
  )).toBe(1);
  const creatorStarts = await creator.locator(".sc-turn-status.is-active").count() === 1;
  const activePage = creatorStarts ? creator : joiner;
  const receivingPage = creatorStarts ? joiner : creator;
  const receivingSequence = (await receivingPage.locator(".sc-sequence").textContent())?.trim();

  await activePage.getByRole("button", { name: "Give clue" }).click();
  await activePage.locator(".sc-clue-grid button").first().click();
  await activePage.getByRole("button", { name: /Send clue/ }).click();

  await expect(receivingPage.locator(".sc-turn-status.is-active")).toBeVisible();
  await expect.poll(async () => (
    (await receivingPage.locator(".sc-sequence").textContent())?.trim()
  )).not.toBe(receivingSequence);
  await expect(receivingPage.locator(".sc-activity li").first()).toContainText("sent a channel clue");
  await assertOwnHandConcealed(creator);
  await assertOwnHandConcealed(joiner);
  expect(creatorErrors).toEqual([]);
  expect(joinerErrors).toEqual([]);
  await creator.close();
  await joiner.close();
});
