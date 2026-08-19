import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Connect4GameView } from "../../packages/web-client/src/game-adapters/connect4/game-view";
import type { Connect4View } from "../../packages/web-client/src/game-adapters/connect4/types";

function view(overrides: Partial<Connect4View> = {}): Connect4View {
  return {
    phase: "play",
    config: { rows: 6, cols: 7, connect: 4 },
    grid: Array.from({ length: 6 }, () => Array(7).fill(null)),
    players: ["player-1", "player-2"],
    currentPlayerId: "player-1",
    winnerPlayerId: null,
    winningCells: [],
    lastDrop: null,
    ...overrides
  };
}

describe("Connect4 React game view", () => {
  test("renders playable columns, seat names, and the current turn", () => {
    const html = renderToStaticMarkup(<Connect4GameView
      view={view()}
      mySeat="player-1"
      seatNames={{ "player-1": "tejas", "player-2": "Computer" }}
      pending={false}
      onDrop={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("Your turn");
    expect(html).toContain("tejas (you)");
    expect(html).toContain("Computer");
    expect(html.match(/c4-drop-btn/g)).toHaveLength(7);
    expect(html).not.toMatch(/c4-drop-btn[^>]*disabled/);
  });

  test("keeps the winning board visible and offers a rematch", () => {
    const terminal = view({
      phase: "terminal",
      winnerPlayerId: "player-1",
      winningCells: [0, 1, 2, 3].map((col) => ({ row: 5, col }))
    });
    for (const cell of terminal.winningCells!) {
      terminal.grid![cell.row]![cell.col] = "player-1";
    }

    const html = renderToStaticMarkup(<Connect4GameView
      view={terminal}
      mySeat="player-1"
      seatNames={{}}
      pending={false}
      onDrop={() => {}}
      onRematch={() => {}}
    />);

    expect(html).toContain("You win!");
    expect(html.match(/c4-cell winning/g)).toHaveLength(4);
    expect(html).toContain('id="rematch-btn"');
    expect(html.match(/c4-drop-btn[^>]*disabled/g)).toHaveLength(7);
  });
});
