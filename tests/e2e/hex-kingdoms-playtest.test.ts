import { describe, expect, test } from "vitest";
import { type JsonValue } from "@board-game-sim/shared";
import {
  hexKingdomsBot,
  scoreHexKingdoms,
  type HexKingdomsView
} from "@board-game-sim/hex-kingdoms";
import definition from "../../packages/games/hex-kingdoms/definition.json";
import { runProductTable, runSyntheticGame, type CompletedGame } from "./support/game-driver";
import { HEX_TEST_POLICIES } from "./support/hex-policies";

const gameDefinition = definition as JsonValue;

function policyRoster(size: number, offset = 0) {
  return Array.from({ length: size }, (_, index) => HEX_TEST_POLICIES[(index + offset) % HEX_TEST_POLICIES.length]!);
}

function assertHexResult(game: CompletedGame): HexKingdomsView {
  expect(game.actions).toHaveLength(game.players.length * definition.turnsPerPlayer);
  const views = game.players.map((playerId) => game.service.getPlayerView(game.sessionId, playerId) as HexKingdomsView);
  const view = views[0]!;
  expect(view.phase).toBe("terminal");
  expect(view.placements).toHaveLength(game.players.length * definition.turnsPerPlayer);
  expect(new Set(view.placements.map((placement) => placement.tileId)).size).toBe(view.placements.length);
  expect(JSON.stringify(views)).not.toContain("drawPile");
  expect(view.scores).toEqual(scoreHexKingdoms({
    players: view.players,
    capitals: view.capitals,
    landmarks: view.landmarks,
    placements: view.placements,
    scoring: view.config.scoring
  }));
  expect(view.winnerPlayerIds).toContain(game.terminal.winnerPlayerId);
  return view;
}

describe("Hex Kingdoms full-session playtests", () => {
  for (const seats of [2, 3, 4]) {
    test(`${seats} synthetic players finish with independent policies`, async () => {
      assertHexResult(await runSyntheticGame({
        gameId: "hex-kingdoms",
        definition: gameDefinition,
        policies: policyRoster(seats),
        seed: `hex-synthetic-${seats}`,
        maxActions: 50
      }));
    });

    for (let humans = 1; humans <= seats; humans += 1) {
      const bots = seats - humans;
      test(`${humans} human pilots + ${bots} reserved bots finish a ${seats}-seat product table`, async () => {
        assertHexResult(await runProductTable({
          gameId: "hex-kingdoms",
          definition: gameDefinition,
          humanPolicies: policyRoster(humans, bots),
          botSeats: bots,
          seed: `hex-product-${seats}-${humans}`,
          maxActions: 50
        }));
      });
    }
  }

  for (const seats of [2, 3, 4]) {
    test(`${seats}-seat 250-seed balance soak stays varied and invariant-safe`, async () => {
      const winners = new Set<string>();
      let ties = 0;
      let landmarkContests = 0;
      for (let seedIndex = 0; seedIndex < 250; seedIndex += 1) {
        const policies = policyRoster(seats, seedIndex % HEX_TEST_POLICIES.length);
        policies[seedIndex % seats] = hexKingdomsBot;
        const game = await runSyntheticGame({
          gameId: "hex-kingdoms",
          definition: gameDefinition,
          policies,
          seed: `hex-soak-${seats}-${seedIndex}`,
          maxActions: 50,
          verifyTerminalFreeze: false
        });
        const view = assertHexResult(game);
        if (view.winnerPlayerIds.length > 1) ties += 1;
        for (const winner of view.winnerPlayerIds) winners.add(winner);
        if (Object.values(view.scores).some((score) => score.landmarks > 0)) landmarkContests += 1;
      }
      expect(winners.size).toBeGreaterThan(1);
      expect(ties).toBeLessThan(125);
      expect(landmarkContests).toBeGreaterThan(125);
    }, 120_000);
  }
});
