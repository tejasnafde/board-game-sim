import { describe, expect, test } from "vitest";
import { runProductTable, runSyntheticGame, type CompletedGame } from "./support/game-driver";
import { MIXED_SEAT_MATRIX } from "./support/mixed-seat-matrix";

function assertCompletedGame(game: CompletedGame, maxActions: number): void {
  expect(game.actions.length).toBeGreaterThan(0);
  expect(game.actions.length).toBeLessThanOrEqual(maxActions);
  expect(game.service.getSessionSeq(game.sessionId)).toBe(game.actions.length);
  if (game.terminal.winnerPlayerId !== null) {
    expect(game.players).toContain(game.terminal.winnerPlayerId);
  }
  for (const playerId of game.players) {
    expect(() => JSON.stringify(game.service.getPlayerView(game.sessionId, playerId))).not.toThrow();
  }
}

describe("all live games mixed-seat matrix", () => {
  test("covers every supported all-AI and product seat composition", () => {
    expect(MIXED_SEAT_MATRIX).toHaveLength(42);
    const actual = MIXED_SEAT_MATRIX.map((scenario) => scenario.title);
    const supported: Array<[string, number[]]> = [
      ["battleship", [2]],
      ["connect4", [2]],
      ["labyrinth", [2, 3, 4]],
      ["hex-kingdoms", [2, 3, 4]],
      ["signal-crew", [2, 3, 4]]
    ];
    const expected = supported.flatMap(([gameId, seatCounts]) => seatCounts.flatMap((seats) => [
      `${gameId}: ${seats} AI`,
      ...Array.from({ length: seats }, (_, index) => (
        `${gameId}: ${index + 1} human + ${seats - index - 1} AI`
      ))
    ]));
    expect(actual).toEqual(expected);
  });

  for (const scenario of MIXED_SEAT_MATRIX) {
    test(`${scenario.title} reaches and freezes at a legal terminal state`, async () => {
      const seed = `mixed-matrix-${scenario.gameId}-${scenario.humanSeats}h-${scenario.botSeats}b`;
      const game = scenario.mode === "all-ai"
        ? await runSyntheticGame({
          gameId: scenario.gameId,
          definition: scenario.definition,
          policies: Array.from({ length: scenario.botSeats }, () => scenario.bot),
          seed,
          maxActions: scenario.maxActions
        })
        : await runProductTable({
          gameId: scenario.gameId,
          definition: scenario.definition,
          humanPolicies: scenario.humanPolicies(scenario.humanSeats, scenario.botSeats),
          botSeats: scenario.botSeats,
          seed,
          maxActions: scenario.maxActions
        });

      assertCompletedGame(game, scenario.maxActions);
    }, 120_000);
  }
});
