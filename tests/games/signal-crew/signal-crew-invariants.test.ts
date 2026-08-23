import { describe, expect, test } from "vitest";
import { createSeededRng, type JsonValue } from "@board-game-sim/shared";
import definition from "../../../packages/games/signal-crew/definition.json";
import {
  assertSignalCrewInvariants,
  SignalCrewModule,
  signalCrewBot,
  type SignalCrewState,
  type SignalCrewView
} from "@board-game-sim/signal-crew";

const module = new SignalCrewModule();

describe("Signal Crew reachable-state invariants", () => {
  for (const seats of [2, 3, 4]) {
    test(`${seats} seats conserve packets and sound knowledge across 50 seeds`, () => {
      for (let seedIndex = 0; seedIndex < 50; seedIndex += 1) {
        const players = Array.from({ length: seats }, (_, index) => `p${index + 1}`);
        let state: SignalCrewState = module.initGame({
          sessionId: `signal-invariant-${seats}-${seedIndex}`,
          gameId: "signal-crew",
          gameVersion: "0.1.0",
          seed: `signal-invariant-${seats}-${seedIndex}`,
          players,
          definition
        }).initialState;
        assertSignalCrewInvariants(state);

        for (let turn = 0; turn < 100 && state.phase === "play"; turn += 1) {
          const playerId = state.currentPlayerId;
          const view = module.getPlayerView({ state, playerId }).visibleState as unknown as SignalCrewView;
          const action = signalCrewBot({
            view: view as unknown as JsonValue,
            definition,
            playerId,
            rng: createSeededRng(`signal-invariant-${seats}-${seedIndex}:${turn}`)
          });
          expect(action, `bot stalled at ${seats} seats seed ${seedIndex} turn ${turn}`).not.toBeNull();
          const result = module.applyAction({
            sessionId: `signal-invariant-${seats}-${seedIndex}`,
            seq: turn + 1,
            seed: `signal-invariant-${seats}-${seedIndex}`,
            state,
            actorPlayerId: playerId,
            actionType: action!.actionType,
            payload: action!.payload
          });
          expect(result.accepted, `${result.reason} at ${seats} seats seed ${seedIndex} turn ${turn}`).toBe(true);
          state = result.nextState;
          assertSignalCrewInvariants(state);
        }
        expect(state.phase, `nonterminal at ${seats} seats seed ${seedIndex}`).toBe("terminal");
      }
    }, 60_000);
  }
});
