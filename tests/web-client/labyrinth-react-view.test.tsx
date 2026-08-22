import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LabyrinthGameView } from "../../packages/web-client/src/game-adapters/labyrinth/game-view";
import type { LabyrinthView } from "../../packages/web-client/src/game-adapters/labyrinth/types";

function view(): LabyrinthView {
  const tile = {
    id: "tile",
    shape: "straight" as const,
    rotationDeg: 90 as const,
    openings: { N: false, E: true, S: false, W: true },
    objectiveId: null
  };
  return {
    phase: "play",
    turnStage: "insert",
    currentPlayerId: "player-1",
    config: { rows: 7, cols: 7, insertionIndexes: [1, 3, 5] },
    board: Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => ({ ...tile }))),
    spareTile: { ...tile, rotationDeg: 0 },
    players: [{
      playerId: "player-1",
      position: { row: 0, col: 0 },
      home: { row: 0, col: 0 },
      objectivesRemainingCount: 1
    }],
    myState: {
      position: { row: 0, col: 0 },
      currentObjective: { id: "owl", position: { row: 0, col: 2 } },
      objectivesRemainingCount: 1,
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
      acceptedActions={[{
        seq: 1,
        actorPlayerId: "player-1",
        events: [{ eventType: "tile.inserted", payload: { edge: "top", index: 1 } }]
      }]}
      logs={[]}
      pending={false}
      onRotate={() => {}}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain('class="labyrinth-play-header"');
    expect(html).toContain('aria-label="Maze board"');
    expect(html).toContain('aria-label="Insert spare tile from top into column 2"');
    expect(html).toContain('aria-label="Rotate spare tile counterclockwise"');
    expect(html).toContain('aria-label="Rotate spare tile clockwise"');
    expect(html).toContain('aria-label="Row 1, column 1,');
    expect(html).toContain("Your objective");
    expect(html).toContain("Row 1 · Column 3");
    expect(html).toContain("You shifted column 2 down");
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
      acceptedActions={[]}
      logs={[]}
      pending={false}
      onRotate={() => {}}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Now move your pawn");
    expect(html).toMatch(/aria-label="Insert spare tile from top into column 2"[^>]*disabled/);
    expect(html).toContain("02 Move");
  });

  test("shows collected treasures in the player who claimed them", () => {
    const collectedView = view();
    collectedView.players![0]!.collectedObjectiveIds = ["owl", "gem"];
    const html = renderToStaticMarkup(<LabyrinthGameView
      view={collectedView}
      mySeat="player-1"
      seatNames={{ "player-1": "Tejas" }}
      acceptedActions={[]}
      logs={[]}
      pending={false}
      onRotate={() => {}}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain('class="labyrinth-player-trophies"');
    expect(html).toContain('aria-label="Collected owl"');
    expect(html).toContain('aria-label="Collected gem"');
  });

  test("locks play while reserved human seats are still empty", () => {
    const html = renderToStaticMarkup(<LabyrinthGameView
      view={view()}
      table={{ humanSeats: 2, botSeats: 1, claimedHumanSeats: 1, ready: false }}
      mySeat="player-1"
      seatNames={{ "player-1": "Tejas", "player-3": "Computer" }}
      acceptedActions={[]}
      logs={[]}
      pending={false}
      onRotate={() => {}}
      onInsert={() => {}}
      onMove={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Waiting for 1 more player");
    expect(html).toMatch(/aria-label="Rotate spare tile clockwise"[^>]*disabled/);
    expect(html).toMatch(/aria-label="Insert spare tile from top into column 2"[^>]*disabled/);
  });
});
