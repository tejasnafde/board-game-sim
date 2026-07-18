import { describe, expect, it } from "vitest";
import { battleshipBot } from "@board-game-sim/battleship";
import type { Coord } from "@board-game-sim/battleship";
import definition from "../../../packages/games/battleship/definition.json";

function makeView(overrides: {
  shotsFired?: Coord[];
  knownHits?: Coord[];
  sunkShips?: { shipId: string; cells: Coord[] }[];
}) {
  return {
    phase: "play",
    currentPlayerId: "me",
    ownBoard: { rows: 10, cols: 10, ships: [{ shipId: "x", cells: [] }] },
    opponentBoard: {
      shotsFired: overrides.shotsFired ?? [],
      knownHits: overrides.knownHits ?? [],
      sunkShips: overrides.sunkShips ?? []
    }
  };
}

const fire = (view: unknown): Coord => {
  const action = battleshipBot({ view: view as never, definition: definition as never, playerId: "me", rng: () => 0.4 });
  expect(action?.actionType).toBe("fire");
  return action!.payload as Coord;
};

describe("battleship bot quality bar", () => {
  it("targets a neighbor after a hit instead of firing randomly", () => {
    const hit = { row: 5, col: 5 };
    const shot = fire(makeView({ shotsFired: [hit], knownHits: [hit] }));
    expect(Math.abs(shot.row - hit.row) + Math.abs(shot.col - hit.col)).toBe(1);
  });

  it("extends a line of two hits at one of its ends", () => {
    const hits = [{ row: 5, col: 4 }, { row: 5, col: 5 }];
    const shot = fire(makeView({ shotsFired: hits, knownHits: hits }));
    expect([{ row: 5, col: 3 }, { row: 5, col: 6 }]).toContainEqual(shot);
  });

  it("goes back to hunting once the ship is sunk", () => {
    const cells = [{ row: 5, col: 4 }, { row: 5, col: 5 }];
    const shot = fire(makeView({ shotsFired: cells, knownHits: cells, sunkShips: [{ shipId: "destroyer", cells }] }));
    // not adjacent-obsessed anymore: parity hunt anywhere fresh
    expect(cells.some((c) => c.row === shot.row && c.col === shot.col)).toBe(false);
    expect((shot.row + shot.col) % 2).toBe(0);
  });

  it("never repeats a shot", () => {
    const shotsFired: Coord[] = [];
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 6; col += 1) shotsFired.push({ row, col });
    }
    const shot = fire(makeView({ shotsFired }));
    expect(shotsFired.some((c) => c.row === shot.row && c.col === shot.col)).toBe(false);
  });
});
