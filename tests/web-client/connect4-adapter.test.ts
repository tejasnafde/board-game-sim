import { describe, expect, it } from "vitest";
import { renderConnect4Gameplay } from "../../packages/web-client/src/game-adapters/connect4/render";
import type { Connect4View } from "../../packages/web-client/src/game-adapters/connect4/types";

function makeView(overrides: Partial<Connect4View> = {}): Connect4View {
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

const count = (haystack: string, needle: RegExp): number => (haystack.match(needle) ?? []).length;

describe("connect4 adapter", () => {
  it("renders drop buttons enabled only on my turn", () => {
    const mine = renderConnect4Gameplay(makeView(), "player-1", {});
    expect(count(mine, /c4-drop-btn/g)).toBe(7);
    expect(count(mine, /c4-drop-btn[^>]*disabled/g)).toBe(0);

    const theirs = renderConnect4Gameplay(makeView(), "player-2", {});
    expect(count(theirs, /c4-drop-btn[^>]*disabled/g)).toBe(7);
    expect(theirs).toContain("Waiting for");
  });

  it("shows discs, seat names, and disables full columns", () => {
    const view = makeView();
    for (let row = 0; row < 6; row += 1) view.grid![row]![3] = row % 2 ? "player-1" : "player-2";
    const html = renderConnect4Gameplay(view, "player-1", {
      seatNames: { "player-1": "tejas", "player-2": "Computer" }
    });
    expect(count(html, /class="c4-disc /g)).toBe(6);
    expect(html).toMatch(/data-col="3"\s+disabled/);
    expect(html).toContain("tejas (you)");
    expect(html).toContain("Computer");
  });

  it("keeps the final board on screen with a result banner and rematch", () => {
    const view = makeView({
      phase: "terminal",
      winnerPlayerId: "player-1",
      winningCells: [0, 1, 2, 3].map((col) => ({ row: 5, col }))
    });
    for (const c of view.winningCells!) view.grid![c.row]![c.col] = "player-1";
    const html = renderConnect4Gameplay(view, "player-1", {});
    expect(html).toContain("You win");
    expect(html).toContain("terminal-banner");
    expect(count(html, /c4-cell winning/g)).toBe(4);
    expect(count(html, /c4-drop-btn/g)).toBe(7); // full board still rendered
    expect(html).toContain('id="rematch-btn"');
  });
});
