import { describe, expect, test } from "vitest";
import { GAME_HUB_CARDS, resolveGameHubNavigation } from "../../packages/web-client/src/browser-app";

describe("game hub", () => {
  test("contains battleship live and two coming soon cards", () => {
    expect(GAME_HUB_CARDS.map((card) => [card.gameId, card.status])).toEqual([
      ["battleship", "live"],
      ["labyrinth", "coming-soon"],
      ["catan", "coming-soon"]
    ]);
  });

  test("only battleship card is navigable", () => {
    expect(resolveGameHubNavigation("battleship")).toEqual({ name: "game", gameId: "battleship" });
    expect(resolveGameHubNavigation("labyrinth")).toBeNull();
    expect(resolveGameHubNavigation("catan")).toBeNull();
  });
});
