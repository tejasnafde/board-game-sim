import { describe, expect, test } from "vitest";
import { GAME_HUB_CARDS, resolveGameHubNavigation } from "../../packages/web-client/src/browser-app";

describe("game hub", () => {
  test("contains battleship and labyrinth live cards", () => {
    expect(GAME_HUB_CARDS.map((card) => [card.gameId, card.status])).toEqual([
      ["battleship", "live"],
      ["labyrinth", "live"],
      ["connect4", "live"],
      ["hex-kingdoms", "live"],
      ["signal-crew", "live"],
      ["catan", "coming-soon"]
    ]);
    expect(GAME_HUB_CARDS.find((card) => card.gameId === "labyrinth")?.releaseTag).toBe("Playable now");
  });

  test("battleship and labyrinth cards are navigable", () => {
    expect(resolveGameHubNavigation("battleship")).toEqual({ name: "game", gameId: "battleship" });
    expect(resolveGameHubNavigation("labyrinth")).toEqual({ name: "game", gameId: "labyrinth" });
    expect(resolveGameHubNavigation("connect4")).toEqual({ name: "game", gameId: "connect4" });
    expect(resolveGameHubNavigation("hex-kingdoms")).toEqual({ name: "game", gameId: "hex-kingdoms" });
    expect(resolveGameHubNavigation("signal-crew")).toEqual({ name: "game", gameId: "signal-crew" });
    expect(resolveGameHubNavigation("catan")).toBeNull();
  });
});
