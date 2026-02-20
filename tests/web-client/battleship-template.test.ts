import { describe, expect, test } from "vitest";
import definition from "../../packages/games/battleship/definition.json";
import { createDefaultPlacementsFromDefinition } from "../../packages/web-client/src/battleship-template";

describe("battleship setup template", () => {
  test("creates one placement per configured ship", () => {
    const placements = createDefaultPlacementsFromDefinition(definition);
    expect(placements).toHaveLength(definition.ships.length);
  });

  test("creates contiguous straight placements with exact sizes", () => {
    const placements = createDefaultPlacementsFromDefinition(definition);

    for (const ship of definition.ships) {
      const placement = placements.find((p) => p.shipId === ship.id);
      expect(placement).toBeDefined();
      expect(placement?.cells.length).toBe(ship.size);

      const rowSet = new Set((placement?.cells ?? []).map((c) => c.row));
      expect(rowSet.size).toBe(1);

      const cols = (placement?.cells ?? []).map((c) => c.col).sort((a, b) => a - b);
      for (let i = 1; i < cols.length; i += 1) {
        expect(cols[i] - cols[i - 1]).toBe(1);
      }
    }
  });
});
