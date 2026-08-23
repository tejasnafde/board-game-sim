import { describe, expect, test } from "vitest";
import { createSeededRng, type JsonValue } from "@board-game-sim/shared";
import definition from "../../../packages/games/signal-crew/definition.json";
import {
  SignalCrewModule,
  signalCrewBot,
  type ConcealedPacketView,
  type SignalCrewState,
  type SignalCrewView
} from "@board-game-sim/signal-crew";

const module = new SignalCrewModule();

function init(): SignalCrewState {
  return module.initGame({
    sessionId: "signal-bot",
    gameId: "signal-crew",
    gameVersion: "0.1.0",
    seed: "signal-bot",
    players: ["p1", "p2"],
    definition
  }).initialState;
}

function view(state: SignalCrewState, playerId = state.currentPlayerId): SignalCrewView {
  return module.getPlayerView({ state, playerId }).visibleState as unknown as SignalCrewView;
}

function act(game: SignalCrewView, playerId = game.currentPlayerId, seed = "bot-choice") {
  return signalCrewBot({
    view: game as unknown as JsonValue,
    definition,
    playerId,
    rng: createSeededRng(seed)
  });
}

describe("Signal Crew bot", () => {
  test("returns null off turn and after terminal", () => {
    const state = init();
    const inactive = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
    expect(act(view(state, inactive), inactive)).toBeNull();
    state.phase = "terminal";
    state.outcome = "lost";
    state.terminalReason = "final_orbit_expired";
    expect(act(view(state))).toBeNull();
  });

  test("certain transmission has priority and uses knowledge only", () => {
    const state = init();
    const game = view(state);
    const ownHand = game.hands.find((hand) => hand.playerId === game.currentPlayerId)!;
    const packet = ownHand.packets[0] as ConcealedPacketView;
    const socket = game.relays[0]!.sockets[0]!;
    packet.possibleChannels = [socket.required.channel];
    packet.possibleRanks = [socket.required.rank];
    const action = act(game);
    expect(action).toEqual({
      actionType: "transmit_packet",
      payload: { packetId: packet.packetId, socketId: socket.id }
    });
  });

  test("forced stand by is the only pass", () => {
    const state = init();
    const actor = state.currentPlayerId;
    state.deck = [];
    state.hands[actor] = [];
    state.bandwidth = 0;
    state.finalOrbitTurnsRemaining = 1;
    const game = view(state);
    expect(game.legalActionTypes).toEqual(["stand_by"]);
    expect(act(game)).toEqual({ actionType: "stand_by", payload: {} });
  });

  test("is deterministic, immutable, and proposes an accepted intent", () => {
    const state = init();
    const game = view(state);
    const before = structuredClone(game);
    const first = act(game, game.currentPlayerId, "same-choice");
    const replay = act(game, game.currentPlayerId, "same-choice");
    expect(first).toEqual(replay);
    expect(game).toEqual(before);
    expect(first).not.toBeNull();
    const result = module.applyAction({
      sessionId: "signal-bot",
      seq: 1,
      seed: "signal-bot",
      state,
      actorPlayerId: state.currentPlayerId,
      actionType: first!.actionType,
      payload: first!.payload
    });
    expect(result.accepted, result.reason).toBe(true);
  });
});
