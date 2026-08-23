import { describe, expect, test } from "vitest";
import { axialKey, coordinatesInRadius } from "@board-game-sim/shared";
import {
  createHexKingdomsTiles,
  parseHexKingdomsDefinition
} from "@board-game-sim/hex-kingdoms";
import definition from "../../../packages/games/hex-kingdoms/definition.json";

describe("Hex Kingdoms definition", () => {
  test("normalizes supported layouts and the exact tile recipe", () => {
    const config = parseHexKingdomsDefinition(definition);
    const tiles = createHexKingdomsTiles(config);

    expect(config.minPlayers).toBe(2);
    expect(config.maxPlayers).toBe(4);
    expect(config.turnsPerPlayer).toBe(10);
    expect(config.marketSize).toBe(4);
    expect(coordinatesInRadius(config.layouts[2]!.radius)).toHaveLength(37);
    expect(coordinatesInRadius(config.layouts[3]!.radius)).toHaveLength(37);
    expect(coordinatesInRadius(config.layouts[4]!.radius)).toHaveLength(61);
    expect(tiles).toHaveLength(48);
    expect(new Set(tiles.map((tile) => tile.id))).toHaveLength(48);

    for (const terrain of config.terrains) {
      const terrainTiles = tiles.filter((tile) => tile.terrain === terrain);
      expect(terrainTiles).toHaveLength(12);
      expect(terrainTiles.filter((tile) => tile.feature === "plain")).toHaveLength(6);
      expect(terrainTiles.filter((tile) => tile.feature === "village")).toHaveLength(3);
      expect(terrainTiles.filter((tile) => tile.feature === "keep")).toHaveLength(2);
      expect(terrainTiles.filter((tile) => tile.feature === "shrine")).toHaveLength(1);
    }
  });

  test("keeps capitals and landmarks unique, in bounds, and roomy enough", () => {
    const config = parseHexKingdomsDefinition(definition);

    for (const playerCount of [2, 3, 4] as const) {
      const layout = config.layouts[playerCount]!;
      const arena = new Set(coordinatesInRadius(layout.radius).map(axialKey));
      const staticKeys = [...layout.capitals, ...layout.landmarks].map(axialKey);

      expect(layout.capitals).toHaveLength(playerCount);
      expect(layout.landmarks).toHaveLength(3);
      expect(new Set(staticKeys)).toHaveLength(staticKeys.length);
      expect(staticKeys.every((key) => arena.has(key))).toBe(true);
      expect(arena.size - staticKeys.length).toBeGreaterThanOrEqual(playerCount * config.turnsPerPlayer);
      expect(createHexKingdomsTiles(config).length).toBeGreaterThanOrEqual(
        config.marketSize + playerCount * config.turnsPerPlayer
      );
    }
  });

  test.each([
    ["unknown terrain", { terrains: ["meadow", "forest", "mountain", "lava"] }],
    ["unknown feature", { tileRecipe: { ...definition.tileRecipe, fortress: 1 } }],
    ["overlapping static cells", {
      layouts: {
        ...definition.layouts,
        "2": {
          ...definition.layouts["2"],
          landmarks: [definition.layouts["2"].capitals[0], ...definition.layouts["2"].landmarks.slice(1)]
        }
      }
    }],
    ["insufficient deck", { tileRecipe: { plain: 1, village: 0, keep: 0, shrine: 0 } }],
    ["invalid scoring", { scoring: { ...definition.scoring, crownlandsPerTile: -1 } }]
  ])("rejects %s", (_label, override) => {
    expect(() => parseHexKingdomsDefinition({ ...definition, ...override })).toThrow(
      "invalid_hex_kingdoms_definition"
    );
  });
});
