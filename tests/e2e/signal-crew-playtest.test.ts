import { describe, expect, test } from "vitest";
import type { JsonValue } from "@board-game-sim/shared";
import {
  signalCrewBot,
  type SignalCrewView
} from "@board-game-sim/signal-crew";
import definition from "../../packages/games/signal-crew/definition.json";
import { runProductTable, runSyntheticGame, type CompletedGame } from "./support/game-driver";
import { SIGNAL_TEST_POLICIES } from "./support/signal-policies";

const gameDefinition = definition as JsonValue;

function policies(size: number, offset = 0) {
  return Array.from({ length: size }, (_, index) => (
    SIGNAL_TEST_POLICIES[(index + offset) % SIGNAL_TEST_POLICIES.length]!
  ));
}

function assertSignalResult(game: CompletedGame): SignalCrewView {
  expect(game.actions.length).toBeGreaterThan(0);
  expect(game.actions.length).toBeLessThanOrEqual(60);
  const views = game.players.map((playerId) => game.service.getPlayerView(game.sessionId, playerId) as SignalCrewView);
  expect(views.every((view) => view.phase === "terminal")).toBe(true);
  expect(views.every((view) => view.terminalReason === game.terminal.reason)).toBe(true);
  expect(game.terminal.winnerPlayerId).toBeNull();
  for (let index = 0; index < game.players.length; index += 1) {
    const ownHand = views[index]!.hands.find((hand) => hand.playerId === game.players[index])!;
    expect(ownHand.packets.every((packet) => packet.concealed && !("face" in packet))).toBe(true);
  }
  return views[0]!;
}

describe("Signal Crew full-session playtests", () => {
  for (const seats of [2, 3, 4]) {
    test(`${seats} synthetic crew seats reach a cooperative outcome`, async () => {
      assertSignalResult(await runSyntheticGame({
        gameId: "signal-crew",
        definition: gameDefinition,
        policies: Array(seats).fill(signalCrewBot),
        seed: `signal-synthetic-${seats}`,
        maxActions: 100
      }));
    });

    for (let humans = 1; humans <= seats; humans += 1) {
      test(`${humans} human pilots + ${seats - humans} reserved bots finish`, async () => {
        assertSignalResult(await runProductTable({
          gameId: "signal-crew",
          definition: gameDefinition,
          humanPolicies: policies(humans, seats - humans),
          botSeats: seats - humans,
          seed: `signal-product-${seats}-${humans}`,
          maxActions: 100
        }));
      });
    }
  }

  for (const seats of [2, 3, 4]) {
    test(`${seats}-seat 250-seed mission soak has varied outcomes and action use`, async () => {
      const reasons = new Set<string>();
      const actionTypes = new Set<string>();
      let wins = 0;
      let totalTurns = 0;
      for (let seedIndex = 0; seedIndex < 250; seedIndex += 1) {
        const game = await runSyntheticGame({
          gameId: "signal-crew",
          definition: gameDefinition,
          policies: Array(seats).fill(signalCrewBot),
          seed: `signal-soak-${seats}-${seedIndex}`,
          maxActions: 100,
          verifyTerminalFreeze: false
        });
        const view = assertSignalResult(game);
        reasons.add(view.terminalReason!);
        if (view.outcome === "won") wins += 1;
        totalTurns += game.actions.length;
        for (const action of game.actions) actionTypes.add(action.actionType);
      }
      expect(reasons.size).toBeGreaterThan(1);
      expect(wins).toBeGreaterThanOrEqual(100);
      expect(wins).toBeLessThanOrEqual(200);
      expect(totalTurns / 250).toBeGreaterThanOrEqual(30);
      expect(totalTurns / 250).toBeLessThanOrEqual(55);
      expect(actionTypes.has("give_clue")).toBe(true);
      expect(actionTypes.has("transmit_packet")).toBe(true);
      expect(actionTypes.has("recycle_packet")).toBe(true);
    }, 120_000);
  }
});
