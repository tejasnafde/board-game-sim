import { describe, expect, test } from "vitest";
import type { JsonValue } from "@board-game-sim/shared";
import definition from "../../../packages/games/signal-crew/definition.json";
import { SignalCrewModule, type SignalCrewState, type SignalFace } from "@board-game-sim/signal-crew";

const module = new SignalCrewModule();

function init(players = ["p1", "p2"]): SignalCrewState {
  return module.initGame({
    sessionId: "signal-terminal",
    gameId: "signal-crew",
    gameVersion: "0.1.0",
    seed: `signal-terminal-${players.length}`,
    players,
    definition
  }).initialState;
}

function apply(state: SignalCrewState, actionType: string, payload: JsonValue = {}) {
  return module.applyAction({
    sessionId: "signal-terminal",
    seq: state.turnIndex + 1,
    seed: "signal-terminal",
    state,
    actorPlayerId: state.currentPlayerId,
    actionType,
    payload
  });
}

function sameFace(a: SignalFace, b: SignalFace): boolean {
  return a.channel === b.channel && a.rank === b.rank;
}

describe("Signal Crew final orbit", () => {
  test.each([2, 3, 4])("the final draw schedules exactly %i future turns", (seats) => {
    const state = init(Array.from({ length: seats }, (_, index) => `p${index + 1}`));
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    const drawId = state.deck[0]!;
    const reserveIds = state.relays.flatMap((relay) => relay.sockets).map((socket, index) => {
      const reserveId = state.deck[index + 1]!;
      state.packetFaces[reserveId] = socket.required;
      return reserveId;
    });
    state.deck = [drawId];
    state.hands.reserve = reserveIds;
    state.bandwidth -= 1;
    const result = apply(state, "recycle_packet", { packetId });
    expect(result.accepted).toBe(true);
    expect(result.nextState.deck).toHaveLength(0);
    expect(result.nextState.finalOrbitTurnsRemaining).toBe(seats);
    expect(result.nextState.currentPlayerId).not.toBe(actor);
    expect(result.emittedEvents).toContainEqual({
      eventType: "final_orbit.started",
      payload: { turnsRemaining: seats }
    });
  });

  test.each([2, 3, 4])("orbit expires after exactly %i post-trigger actions", (seats) => {
    let state = init(Array.from({ length: seats }, (_, index) => `p${index + 1}`));
    const reserveIds = state.relays.flatMap((relay) => relay.sockets).map((socket, index) => {
      const packetId = `reserve-${index}`;
      state.packetFaces[packetId] = socket.required;
      return packetId;
    });
    state.deck = [];
    state.bandwidth = 0;
    state.finalOrbitTurnsRemaining = seats;
    for (const playerId of state.players) {
      state.hands[playerId] = [];
      state.knowledge[playerId] = {};
    }
    state.hands.reserve = reserveIds;

    for (let turn = seats; turn > 0; turn -= 1) {
      const result = apply(state, "stand_by");
      expect(result.accepted).toBe(true);
      expect(result.nextState.finalOrbitTurnsRemaining).toBe(turn - 1);
      if (turn > 1) expect(result.nextState.phase).toBe("play");
      state = result.nextState;
    }
    expect(state.phase).toBe("terminal");
    expect(state.terminalReason).toBe("final_orbit_expired");
  });

  test("victory on the final orbit action takes precedence over expiry", () => {
    const state = init();
    const sockets = state.relays.flatMap((relay) => relay.sockets);
    for (const socket of sockets.slice(0, -1)) {
      const packetId = state.deck.shift()!;
      state.packetFaces[packetId] = socket.required;
      socket.filledPacketId = packetId;
    }
    for (const relay of state.relays.slice(0, -1)) relay.completed = true;
    state.relays.at(-1)!.sockets[0]!.filledPacketId = sockets.at(-2)!.filledPacketId;
    state.relays.at(-1)!.completed = false;
    const lastSocket = sockets.at(-1)!;
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    state.packetFaces[packetId] = lastSocket.required;
    state.deck = [];
    state.finalOrbitTurnsRemaining = 1;

    const result = apply(state, "transmit_packet", { packetId, socketId: lastSocket.id });
    expect(result.accepted).toBe(true);
    expect(result.nextState.outcome).toBe("won");
    expect(result.nextState.terminalReason).toBe("crew_victory");
  });
});

describe("Signal Crew terminal precedence", () => {
  test("overload takes precedence when a failed packet is also exhausted", () => {
    const state = init();
    state.interference = state.config.interferenceLimit - 1;
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    const face = state.packetFaces[packetId]!;
    const socket = state.relays.flatMap((relay) => relay.sockets)
      .find((candidate) => !sameFace(candidate.required, face))!;
    state.deck = [];
    const result = apply(state, "transmit_packet", { packetId, socketId: socket.id });
    expect(result.nextState.terminalReason).toBe("interference_overload");
  });

  test("required packet exhaustion ends the mission", () => {
    const state = init();
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    const face = state.packetFaces[packetId]!;
    state.relays[0]!.sockets[0]!.required = face;
    state.bandwidth -= 1;
    state.deck = [];
    for (const playerId of state.players) {
      for (const id of state.hands[playerId]!) {
        if (id !== packetId && sameFace(state.packetFaces[id]!, face)) {
          state.packetFaces[id] = { channel: "azure", rank: face.channel === "azure" && face.rank === 1 ? 2 : 1 };
        }
      }
    }
    const result = apply(state, "recycle_packet", { packetId });
    expect(result.accepted).toBe(true);
    expect(result.nextState.terminalReason).toBe("required_packet_exhausted");
  });

  test("terminal state rejects every later action", () => {
    const state = init();
    state.phase = "terminal";
    state.outcome = "lost";
    state.terminalReason = "final_orbit_expired";
    expect(apply(state, "stand_by")).toMatchObject({ accepted: false, reason: "terminal_state" });
  });
});
