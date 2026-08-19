import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LabyrinthGameView } from "../../packages/web-client/src/game-adapters/labyrinth/game-view";
import type { LabyrinthView } from "../../packages/web-client/src/game-adapters/labyrinth/types";

function view(): LabyrinthView {
  const tile = {
    openings: { N: false, E: true, S: false, W: true },
    objectiveId: null
  };
  return {
    phase: "play",
    turnStage: "insert",
    currentPlayerId: "player-1",
    config: { rows: 7, cols: 7, insertionIndexes: [1, 3, 5] },
    board: Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => ({ ...tile }))),
    spareTile: tile,
    players: [{
      playerId: "player-1",
      position: { row: 0, col: 0 },
      home: { row: 0, col: 0 },
      objectivesRemainingCount: 1
    }],
    myState: {
      position: { row: 0, col: 0 },
      remainingObjectives: [{ id: "owl" }],
      reachableCells: [{ row: 0, col: 0 }]
    }
  };
}

describe("Labyrinth React game view", () => {
  test("renders insert controls, maze semantics, objectives, and activity", () => {
    const html = renderToStaticMarkup(<LabyrinthGameView
      view={view()}
      mySeat="player-1"
      seatNames={{ "player-1": "Tejas" }}
      lastEvents={[]}
      logs={[]}
      pending={false}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain('class="labyrinth-play-header"');
    expect(html).toContain('aria-label="Maze board"');
    expect(html).toContain('aria-label="Insert spare tile from top into column 2"');
    expect(html).toContain('aria-label="Row 1, column 1,');
    expect(html).toContain("Your objective");
    expect(html).toContain('role="log"');
  });

  test("disables reverse insertion and announces the move stage", () => {
    const moveView = view();
    moveView.turnStage = "move";
    moveView.lastInsertion = { edge: "bottom", index: 1 };
    const html = renderToStaticMarkup(<LabyrinthGameView
      view={moveView}
      mySeat="player-1"
      seatNames={{}}
      lastEvents={[]}
      logs={[]}
      pending={false}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Now move your pawn");
    expect(html).toMatch(/aria-label="Insert spare tile from top into column 2"[^>]*disabled/);
    expect(html).toContain("02 Move");
  });
});
