import { describe, expect, test } from "vitest";
import { GridRenderer } from "../../packages/web-client/src/grid-renderer";

describe("grid renderer", () => {
  test("renders own and opponent boards with semantic cell classes", () => {
    const renderer = new GridRenderer();
    const html = renderer.render({
      phase: "play",
      currentPlayerId: "p1",
      ownBoard: {
        rows: 2,
        cols: 2,
        ships: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }],
        hitsTaken: [{ row: 0, col: 0 }],
        sunkShipIds: [],
        shotsFired: []
      },
      opponentBoard: {
        rows: 2,
        cols: 2,
        shotsFired: [{ row: 1, col: 1 }],
        knownHits: [{ row: 1, col: 1 }],
        sunkShips: []
      }
    });

    expect(html).toContain("board-root");
    expect(html).toContain("cell ship");
    expect(html).toContain("taken-hit");
    expect(html).toContain("attack-hit");
  });
});
