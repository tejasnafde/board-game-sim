import { describe, expect, test } from "vitest";
import {
  createGameCatalog,
  type GameCatalogEntry
} from "../../packages/web-client/src/game-catalog";

function entry(gameId: string, status: "live" | "coming-soon" = "live"): GameCatalogEntry {
  return {
    manifest: {
      gameId,
      version: "0.1.0",
      title: gameId,
      summary: `${gameId} summary`,
      status,
      releaseTag: status === "live" ? "Playable now" : "Coming soon",
      players: "2 players",
      turnStyle: "Alternating turns",
      defaultAssetPackId: "default"
    }
  };
}

describe("game catalog", () => {
  test("resolves registered entries and lists them in registration order", () => {
    const battleship = entry("battleship");
    const labyrinth = entry("labyrinth");
    const catalog = createGameCatalog([battleship, labyrinth]);

    expect(catalog.resolve("battleship")).toBe(battleship);
    expect(catalog.resolve("missing")).toBeUndefined();
    expect(catalog.list()).toEqual([battleship, labyrinth]);
  });

  test("preserves module-specific client capabilities", () => {
    const launch = () => "launched";
    const catalog = createGameCatalog([{
      ...entry("battleship"),
      client: { launch }
    }]);

    expect(catalog.resolvePlayable("battleship")?.client.launch()).toBe("launched");
  });

  test("rejects duplicate game IDs", () => {
    expect(() => createGameCatalog([entry("battleship"), entry("battleship")])).toThrow(
      "duplicate_game_id:battleship"
    );
  });

  test("returns only live entries as playable", () => {
    const battleship = entry("battleship");
    const catan = entry("catan", "coming-soon");
    const catalog = createGameCatalog([battleship, catan]);

    expect(catalog.listPlayable()).toEqual([battleship]);
    expect(catalog.resolvePlayable("battleship")).toBe(battleship);
    expect(catalog.resolvePlayable("catan")).toBeUndefined();
  });
});
