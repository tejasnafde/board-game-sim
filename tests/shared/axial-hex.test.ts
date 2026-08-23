import { describe, expect, test } from "vitest";
import {
  axialDistance,
  axialKey,
  axialNeighbors,
  coordinatesInRadius,
  isWithinRadius,
  parseAxialKey,
  type AxialCoord
} from "@board-game-sim/shared";

describe("axial hex topology", () => {
  test("returns six unique neighbors in stable clockwise order", () => {
    const origin = { q: 0, r: 0 };
    const neighbors = axialNeighbors(origin);

    expect(neighbors).toEqual([
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ]);
    expect(new Set(neighbors.map(axialKey))).toHaveLength(6);
    for (const neighbor of neighbors) {
      expect(axialNeighbors(neighbor).map(axialKey)).toContain(axialKey(origin));
    }
  });

  test("round-trips stable coordinate keys", () => {
    const coordinates: AxialCoord[] = [
      { q: 0, r: 0 },
      { q: -3, r: 2 },
      { q: 4, r: -4 }
    ];

    for (const coordinate of coordinates) {
      expect(parseAxialKey(axialKey(coordinate))).toEqual(coordinate);
    }
    expect(() => parseAxialKey("not-a-coordinate")).toThrow("invalid_axial_key");
  });

  test("obeys distance identity, symmetry, and triangle inequality", () => {
    const a = { q: -2, r: 1 };
    const b = { q: 1, r: -3 };
    const c = { q: 3, r: -1 };

    expect(axialDistance(a, a)).toBe(0);
    expect(axialDistance(a, b)).toBe(axialDistance(b, a));
    expect(axialDistance(a, c)).toBeLessThanOrEqual(axialDistance(a, b) + axialDistance(b, c));
  });

  test("generates complete radii in deterministic order", () => {
    const radiusThree = coordinatesInRadius(3);
    const radiusFour = coordinatesInRadius(4);

    expect(radiusThree).toHaveLength(37);
    expect(radiusFour).toHaveLength(61);
    expect(radiusThree).toEqual(coordinatesInRadius(3));
    expect(new Set(radiusFour.map(axialKey))).toHaveLength(61);
    expect(radiusFour.every((coordinate) => isWithinRadius(coordinate, 4))).toBe(true);
    expect(isWithinRadius({ q: 5, r: -5 }, 4)).toBe(false);
  });
});
