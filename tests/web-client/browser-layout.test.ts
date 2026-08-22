import { describe, expect, test } from "vitest";
import { getGameplayPanelOrder } from "../../packages/web-client/src/browser-app";
import { renderAppShell } from "../../packages/web-client/src/app-shell";
import { lobbyPanelMarkup } from "../../packages/web-client/src/templates/lobby";

describe("browser gameplay layout", () => {
  test("keeps debug panel before state panel", () => {
    expect(getGameplayPanelOrder()).toEqual(["debug", "state"]);
  });

  test("app shell exposes keyboard navigation and semantic session copying", () => {
    const html = renderAppShell("<p>Game</p>", { name: "game", gameId: "labyrinth" }, "S1", "P1");

    expect(html).toContain('class="skip-link"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('<button class="top-chip" id="copy-session-btn"');
  });

  test("credits the selected open-source visual pack", () => {
    const html = renderAppShell(
      "<p>Game</p>",
      { name: "game", gameId: "battleship" },
      "S1",
      "P1",
      {
        selected: "sea-command",
        packs: [{ id: "sea-command", label: "Sea Command" }],
        credit: {
          author: "Lowder2",
          license: "CC0-1.0",
          sourceUrl: "https://opengameart.org/content/sea-warfare-set-ships-and-more"
        }
      }
    );

    expect(html).toContain("Art: Lowder2 · CC0-1.0");
    expect(html).toContain('rel="noreferrer"');
  });

  test("playable lobbies make the computer the explicit default opponent", () => {
    const html = lobbyPanelMarkup("S1", "P1", {
      title: "Table",
      joinLabel: "Join",
      vsBot: true
    });

    expect(html).toContain('id="mode-bot"');
    expect(html).toMatch(/id="mode-bot"[^>]*checked/);
    expect(html).toContain('id="mode-private"');
    expect(html).toContain("The server plays every opponent seat");
  });

  test("mixed-table lobbies choose human and computer seats explicitly", () => {
    const html = lobbyPanelMarkup("S1", "P1", {
      title: "Maze",
      joinLabel: "Join",
      tablePlan: { humanSeats: 2, botSeats: 1 }
    });

    expect(html).toContain('id="human-seats"');
    expect(html).toMatch(/id="human-seats"[\s\S]*value="2" selected/);
    expect(html).toContain('id="bot-seats"');
    expect(html).toMatch(/id="bot-seats"[\s\S]*value="1" selected/);
    expect(html).toContain("Game waits for every human seat");
  });
});
