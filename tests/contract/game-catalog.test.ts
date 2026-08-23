import { describe, expect, test } from "vitest";
import { InMemoryGameRegistry } from "@board-game-sim/engine";
import {
  BUILT_IN_GAMES,
  createBuiltInGameCatalog,
  registerBuiltInGames,
  resolveBuiltInGame
} from "@board-game-sim/server";

describe("server game catalog", () => {
  test("is the single source for engine registration and gateway metadata", () => {
    const registry = new InMemoryGameRegistry();
    const registered = registerBuiltInGames(registry);

    expect(registered).toHaveLength(BUILT_IN_GAMES.length);
    for (const entry of BUILT_IN_GAMES) {
      expect(registry.resolve(entry.gameId, entry.version)).toMatchObject({
        gameId: entry.gameId,
        version: entry.version,
        definition: entry.definition,
        module: entry.module
      });
      expect(resolveBuiltInGame(entry.gameId)).toBe(entry);
      expect(entry.minSeats).toBeGreaterThanOrEqual(2);
      expect(entry.maxSeats).toBeGreaterThanOrEqual(entry.minSeats);
      expect(typeof entry.bot).toBe("function");
    }
    expect(BUILT_IN_GAMES.map((entry) => entry.gameId)).toContain("hex-kingdoms");
    expect(BUILT_IN_GAMES.map((entry) => entry.gameId)).toContain("signal-crew");
  });

  test("rejects duplicate game IDs", () => {
    const entry = BUILT_IN_GAMES[0]!;
    expect(() => createBuiltInGameCatalog([entry, entry])).toThrow(
      `duplicate_built_in_game:${entry.gameId}`
    );
  });

  test("returns null for unsupported games", () => {
    expect(resolveBuiltInGame("missing-game")).toBeNull();
  });

  test("freezes the catalog and its entries at runtime", () => {
    expect(Object.isFrozen(BUILT_IN_GAMES)).toBe(true);
    expect(BUILT_IN_GAMES.every(Object.isFrozen)).toBe(true);
  });
});
