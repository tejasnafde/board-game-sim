import { describe, expect, test } from "vitest";
import { renderBattleshipGameplay } from "../../packages/web-client/src/game-adapters/battleship";

describe("battleship gameplay presentation", () => {
  test("shows player-facing fleet and salvo information with diagnostics collapsed", () => {
    const html = renderBattleshipGameplay(
      "play",
      {
        phase: "play",
        currentPlayerId: "player-1",
        ownBoard: { ships: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }] }] }
      },
      true,
      '<div class="board-root"></div>',
      ["recv session.state_sync"],
      "",
      {
        seatNames: { "player-1": "Tejas", "player-2": "Computer" },
        lastEvents: [{ eventType: "shot.hit", payload: { target: { row: 2, col: 3 } } }]
      }
    );

    expect(html).toContain("battle-command-header");
    expect(html).toContain("Fleet integrity");
    expect(html).toContain("Recent salvo");
    expect(html).toContain("Hit confirmed");
    expect(html).toContain("<details");
    expect(html).toContain("Diagnostics");
  });
});
