import { describe, expect, test } from "vitest";
import { resolveGameHubNavigation } from "../../packages/web-client/src/browser-app";
import { renderLabyrinthGameplay } from "../../packages/web-client/src/game-adapters/labyrinth/render";
import type { LabyrinthView } from "../../packages/web-client/src/game-adapters/labyrinth/types";

function makeView(): LabyrinthView {
  const tile = {
    id: "tile",
    openings: { N: false, E: false, S: false, W: false },
    objectiveId: null
  };
  return {
    phase: "play",
    turnStage: "insert",
    currentPlayerId: "player-1",
    winnerPlayerId: null,
    config: { rows: 7, cols: 7, insertionIndexes: [1, 3, 5] },
    board: Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => ({ ...tile }))),
    spareTile: tile,
    lastInsertion: null,
    players: [
      {
        playerId: "player-1",
        position: { row: 0, col: 0 },
        home: { row: 0, col: 0 },
        objectivesRemainingCount: 1
      }
    ],
    myState: {
      position: { row: 0, col: 0 },
      home: { row: 0, col: 0 },
      remainingObjectives: [{ id: "owl" }],
      reachableCells: [{ row: 0, col: 0 }]
    }
  };
}

describe("labyrinth adapter", () => {
  test("labyrinth is navigable from game hub", () => {
    expect(resolveGameHubNavigation("labyrinth")).toEqual({ name: "game", gameId: "labyrinth" });
  });

  test("gameplay exposes turn guidance, board controls, and activity semantics", () => {
    const html = renderLabyrinthGameplay(makeView(), "player-1", [], "", {
      seatNames: { "player-1": "Tejas" },
      lastEvents: []
    });

    expect(html).toContain('class="labyrinth-play-header"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Recent activity"');
    expect(html).toContain('aria-label="Maze board"');
    expect(html).toContain('aria-label="Insert spare tile from top into column 2"');
    expect(html).toContain('aria-label="Row 1, column 1,');
    expect(html).toContain("<h2>Your objective</h2>");
  });
});
