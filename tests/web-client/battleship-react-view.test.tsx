import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  BattleshipGameView,
  BattleshipSetupView
} from "../../packages/web-client/src/game-adapters/battleship/game-view";
import type {
  BattleshipDefinition,
  ClientView
} from "../../packages/web-client/src/game-adapters/battleship/types";

const view: ClientView = {
  phase: "play",
  currentPlayerId: "player-1",
  ownBoard: {
    ships: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }],
    hitsTaken: [{ row: 0, col: 0 }]
  },
  opponentBoard: { shotsFired: [], knownHits: [], sunkShips: [] }
};

describe("Battleship React game view", () => {
  test("renders fleet placement controls and enables a complete draft", () => {
    const definition: BattleshipDefinition = {
      board: { rows: 2, cols: 2 },
      ships: [{ id: "destroyer", size: 2 }]
    };
    const html = renderToStaticMarkup(<BattleshipSetupView
      definition={definition}
      shipPreview={{ destroyer: { url: "/destroyer.png", nativeFacing: "north" } }}
      placementDraftMap={{ destroyer: { row: 0, col: 0, rotationDeg: 0 } }}
      selectedShipId="destroyer"
      waiting={false}
      onClear={() => {}}
      onLoadTemplate={() => {}}
      onPlace={() => {}}
      onRandomize={() => {}}
      onRejoin={() => {}}
      onRotate={() => {}}
      onSelectShip={() => {}}
      onSubmit={() => {}}
    />);

    expect(html).toContain('id="placement-board"');
    expect(html).toContain('id="rotate-btn"');
    expect(html).toContain('id="submit-setup-btn"');
    expect(html).toContain("Submit Fleet");
    expect(html).not.toMatch(/id="submit-setup-btn"[^>]*disabled/);
  });

  test("renders command status, fleet integrity, and the game-owned board", () => {
    const html = renderToStaticMarkup(<BattleshipGameView
      view={view}
      mySeat="player-1"
      seatNames={{ "player-1": "tejas", "player-2": "Computer" }}
      acceptedActions={[]}
      logs={[]}
      boardMarkup='<div class="board-root">board</div>'
      pending={false}
      onFire={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Your turn");
    expect(html).toContain("50%");
    expect(html).toContain("board-root");
    expect(html).toContain("Computer");
  });

  test("keeps outgoing and incoming salvo feedback in the correct perspective", () => {
    const html = renderToStaticMarkup(<BattleshipGameView
      view={view}
      mySeat="player-1"
      seatNames={{ "player-1": "tejas", "player-2": "Computer" }}
      acceptedActions={[
        {
          seq: 10,
          actorPlayerId: "player-1",
          events: [{ eventType: "shot.hit", payload: { at: { row: 2, col: 3 }, shipId: "carrier" } }]
        },
        {
          seq: 11,
          actorPlayerId: "player-2",
          events: [
            { eventType: "shot.hit", payload: { at: { row: 0, col: 1 }, shipId: "destroyer" } },
            { eventType: "ship.sunk", payload: { shipId: "destroyer", ownerPlayerId: "player-1" } }
          ]
        }
      ]}
      logs={[]}
      boardMarkup='<div class="board-root">board</div>'
      pending={false}
      onFire={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Your last salvo");
    expect(html).toContain("D3 struck carrier");
    expect(html).toContain("Incoming fire");
    expect(html).toContain("Computer sank your destroyer");
    expect(html).not.toContain("Sunk their destroyer");
  });

  test("keeps the revealed board and rematch action at terminal state", () => {
    const html = renderToStaticMarkup(<BattleshipGameView
      view={{ ...view, phase: "terminal", winnerPlayerId: "player-1" }}
      mySeat="player-1"
      seatNames={{ "player-1": "tejas" }}
      acceptedActions={[{
        seq: 12,
        actorPlayerId: "player-1",
        events: [{ eventType: "ship.sunk", payload: { shipId: "destroyer" } }]
      }]}
      logs={[]}
      boardMarkup='<div class="board-root">revealed</div>'
      pending={false}
      onFire={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("tejas wins the battle!");
    expect(html).toContain("revealed");
    expect(html).toContain('id="rematch-btn"');
    expect(html).not.toContain("last-result");
  });
});
