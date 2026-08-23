import { describe, expect, test } from "vitest";
import type { JsonValue } from "@board-game-sim/shared";
import definition from "../../../packages/games/signal-crew/definition.json";
import {
  SignalCrewModule,
  type SignalCrewState,
  type SignalCrewView,
  type SignalFace
} from "@board-game-sim/signal-crew";

const module = new SignalCrewModule();

function init(seed = "signal-rules", players = ["p1", "p2"]): SignalCrewState {
  return module.initGame({
    sessionId: "signal-rules",
    gameId: "signal-crew",
    gameVersion: "0.1.0",
    seed,
    players,
    definition
  }).initialState;
}

function apply(state: SignalCrewState, actionType: string, payload: unknown, actor = state.currentPlayerId) {
  return module.applyAction({
    sessionId: "signal-rules",
    seq: state.turnIndex + 1,
    seed: "signal-rules",
    state,
    actorPlayerId: actor,
    actionType,
    payload: payload as JsonValue
  });
}

function faceKey(face: SignalFace): string {
  return `${face.channel}:${face.rank}`;
}

describe("Signal Crew setup", () => {
  test.each([[2, 5, 8], [3, 4, 10], [4, 3, 12]])(
    "%i players receive the configured hand and bandwidth",
    (seats, handSize, bandwidth) => {
      const players = Array.from({ length: seats }, (_, index) => `p${index + 1}`);
      const state = init(`signal-${seats}`, players);
      expect(Object.values(state.hands).map((hand) => hand.length)).toEqual(Array(seats).fill(handSize));
      expect(state.bandwidth).toBe(bandwidth);
      expect(state.maxBandwidth).toBe(bandwidth);
      expect(Object.keys(state.packetFaces)).toHaveLength(32);
      expect(new Set([...state.deck, ...Object.values(state.hands).flat()]).size).toBe(32);
      expect(new Set(
        state.relays.flatMap((relay) => relay.sockets.map((socket) => faceKey(socket.required)))
      ).size).toBe(10);
    }
  );

  test("setup is deterministic, varied, and opaque IDs reveal no face or order", () => {
    const first = init("same");
    const replay = init("same");
    const varied = init("different");
    expect(first).toEqual(replay);
    expect(first).not.toEqual(varied);
    expect(Object.keys(first.packetFaces).every((id) => /^pkt_[a-f0-9]{24}$/.test(id))).toBe(true);
    for (const id of [...first.deck, ...Object.values(first.hands).flat()]) {
      const face = first.packetFaces[id]!;
      expect(id).not.toContain(face.channel);
    }
  });
});

describe("Signal Crew actions", () => {
  test("a clue updates every matching and nonmatching target card", () => {
    const state = init();
    const target = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
    const targetCards = state.hands[target]!;
    const value = state.packetFaces[targetCards[0]!]!.channel;
    const result = apply(state, "give_clue", { targetPlayerId: target, attribute: "channel", value });
    expect(result.accepted).toBe(true);
    expect(result.nextState.bandwidth).toBe(state.bandwidth - 1);
    for (const packetId of targetCards) {
      const matches = state.packetFaces[packetId]!.channel === value;
      expect(result.nextState.knowledge[target]![packetId]!.clues.at(-1)?.matches).toBe(matches);
    }
    expect(result.emittedEvents[0]).toMatchObject({
      eventType: "clue.given",
      payload: { targetPlayerId: target, attribute: "channel", value }
    });
  });

  test("rejects repeated clues that add no knowledge", () => {
    const state = init();
    const target = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
    const value = state.packetFaces[state.hands[target]![0]!]!.rank;
    const first = apply(state, "give_clue", { targetPlayerId: target, attribute: "rank", value });
    expect(first.accepted).toBe(true);
    first.nextState.currentPlayerId = state.currentPlayerId;
    first.nextState.currentPlayerIndex = state.currentPlayerIndex;
    const repeated = apply(first.nextState, "give_clue", { targetPlayerId: target, attribute: "rank", value });
    expect(repeated.accepted).toBe(false);
    expect(repeated.reason).toBe("clue_adds_no_information");
  });

  test("correct transmission fills a socket, draws safely, and rewards a completed relay", () => {
    const state = init();
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    const face = state.packetFaces[packetId]!;
    const relay = state.relays[0]!;
    relay.sockets[1]!.required = face;
    relay.sockets[0]!.filledPacketId = "already-filled";
    state.packetFaces["already-filled"] = relay.sockets[0]!.required;
    state.bandwidth -= 1;
    const deckBefore = state.deck.length;

    const result = apply(state, "transmit_packet", { packetId, socketId: relay.sockets[1]!.id });
    expect(result.accepted).toBe(true);
    expect(result.nextState.relays[0]?.completed).toBe(true);
    expect(result.nextState.relays[0]?.sockets[1]?.filledPacketId).toBe(packetId);
    expect(result.nextState.deck).toHaveLength(deckBefore - 1);
    expect(result.nextState.hands[actor]).toHaveLength(state.hands[actor]!.length);
    expect(result.nextState.bandwidth).toBe(state.bandwidth + 1);
    expect(JSON.stringify(result.emittedEvents.find((event) => event.eventType === "packet.drawn")))
      .not.toContain(JSON.stringify(face));
  });

  test("failed transmission reveals, discards, and adds interference", () => {
    const state = init();
    const actor = state.currentPlayerId;
    const packetId = state.hands[actor]![0]!;
    const face = state.packetFaces[packetId]!;
    const socket = state.relays.flatMap((relay) => relay.sockets)
      .find((candidate) => faceKey(candidate.required) !== faceKey(face))!;
    const result = apply(state, "transmit_packet", { packetId, socketId: socket.id });
    expect(result.accepted).toBe(true);
    expect(result.nextState.interference).toBe(1);
    expect(result.nextState.discard.at(-1)).toEqual({ packetId, face, reason: "failed_transmission" });
    expect(result.emittedEvents).toContainEqual(expect.objectContaining({ eventType: "packet.transmitted" }));
  });

  test("recycle requires spare bandwidth and reveals the packet", () => {
    const full = init();
    const actor = full.currentPlayerId;
    const packetId = full.hands[actor]![0]!;
    expect(apply(full, "recycle_packet", { packetId })).toMatchObject({
      accepted: false,
      reason: "bandwidth_full"
    });
    full.bandwidth -= 1;
    const result = apply(full, "recycle_packet", { packetId });
    expect(result.accepted).toBe(true);
    expect(result.nextState.bandwidth).toBe(full.bandwidth + 1);
    expect(result.nextState.discard.at(-1)?.reason).toBe("recycled");
  });

  test("illegal actions reject without mutating state", () => {
    const state = init();
    const before = structuredClone(state);
    expect(apply(state, "give_clue", { targetPlayerId: state.currentPlayerId, attribute: "rank", value: 1 }))
      .toMatchObject({ accepted: false, reason: "invalid_clue_target" });
    expect(apply(state, "transmit_packet", { packetId: "unknown", socketId: "unknown" }))
      .toMatchObject({ accepted: false, reason: "unknown_packet" });
    expect(apply(state, "stand_by", {})).toMatchObject({ accepted: false, reason: "productive_action_available" });
    expect(apply(state, "give_clue", {}, state.players.find((playerId) => playerId !== state.currentPlayerId)))
      .toMatchObject({ accepted: false, reason: "not_your_turn" });
    expect(state).toEqual(before);
  });

  test("rejects malformed and unavailable intents without changing their input state", () => {
    const scenario = (
      prepare: (state: SignalCrewState) => { actionType: string; payload: unknown },
      reason: string
    ) => {
      const state = init();
      const intent = prepare(state);
      const before = structuredClone(state);
      const result = apply(state, intent.actionType, intent.payload);
      expect(result).toMatchObject({ accepted: false, reason });
      expect(state).toEqual(before);
      expect(result.nextState).toBe(state);
    };

    scenario(() => ({ actionType: "give_clue", payload: {} }), "invalid_payload");
    scenario(() => ({ actionType: "transmit_packet", payload: {} }), "invalid_payload");
    scenario(() => ({ actionType: "recycle_packet", payload: {} }), "invalid_payload");
    scenario((state) => ({
      actionType: "give_clue",
      payload: {
        targetPlayerId: state.players.find((playerId) => playerId !== state.currentPlayerId),
        attribute: "channel",
        value: "unknown"
      }
    }), "invalid_clue_value");
    scenario((state) => {
      const targetPlayerId = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
      for (const packetId of state.hands[targetPlayerId]!) {
        state.packetFaces[packetId] = { channel: "azure", rank: 1 };
      }
      return { actionType: "give_clue", payload: { targetPlayerId, attribute: "channel", value: "jade" } };
    }, "clue_matches_no_packets");
    scenario((state) => {
      state.bandwidth = 0;
      const targetPlayerId = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
      const value = state.packetFaces[state.hands[targetPlayerId]![0]!]!.channel;
      return { actionType: "give_clue", payload: { targetPlayerId, attribute: "channel", value } };
    }, "bandwidth_empty");
    scenario((state) => ({
      actionType: "transmit_packet",
      payload: { packetId: state.hands[state.currentPlayerId]![0], socketId: "unknown" }
    }), "unknown_socket");
    scenario((state) => {
      const socket = state.relays[0]!.sockets[0]!;
      socket.filledPacketId = state.deck[0]!;
      return {
        actionType: "transmit_packet",
        payload: { packetId: state.hands[state.currentPlayerId]![0], socketId: socket.id }
      };
    }, "socket_filled");
    scenario(() => ({ actionType: "invent_signal", payload: {} }), "unsupported_action");
  });
});

describe("Signal Crew terminal and views", () => {
  test("stand by resolves the last forced orbit turn", () => {
    const state = init();
    const actor = state.currentPlayerId;
    state.deck = [];
    state.hands[actor] = [];
    state.bandwidth = 0;
    state.finalOrbitTurnsRemaining = 1;
    const other = state.players.find((playerId) => playerId !== actor)!;
    state.hands[other] = state.relays.flatMap((relay) => relay.sockets).map((socket, index) => {
      const packetId = `required-${index}`;
      state.packetFaces[packetId] = socket.required;
      return packetId;
    });

    const result = apply(state, "stand_by", {});
    expect(result.accepted).toBe(true);
    expect(result.nextState.phase).toBe("terminal");
    expect(result.nextState.terminalReason).toBe("final_orbit_expired");
    expect(result.emittedEvents).toContainEqual(expect.objectContaining({ eventType: "crew.stood_by" }));
  });

  test("own faces and deck order stay hidden while teammate faces are visible", () => {
    const state = init();
    const viewer = state.players[0]!;
    const ownPacket = state.hands[viewer]![0]!;
    state.packetFaces[ownPacket] = { channel: "sentinel" as never, rank: 99 as never };
    const teammate = state.players[1]!;
    const teammatePacket = state.hands[teammate]![0]!;
    state.packetFaces[teammatePacket] = { channel: "visible-sentinel" as never, rank: 88 as never };

    const view = module.getPlayerView({ state, playerId: viewer }).visibleState as unknown as SignalCrewView;
    expect(JSON.stringify(view)).not.toContain("sentinel\",\"rank\":99");
    expect(JSON.stringify(view)).toContain("visible-sentinel");
    expect(JSON.stringify(view)).not.toContain("deck");
    expect(view.hands.find((hand) => hand.playerId === viewer)?.packets.every((packet) => packet.concealed)).toBe(true);

    const unknown = module.getPlayerView({ state, playerId: "unseated" }).visibleState as unknown as SignalCrewView;
    expect(unknown.youPlayerId).toBeNull();
    expect(unknown.canAct).toBe(false);
    expect(unknown.hands.every((hand) => hand.packets.every((packet) => packet.concealed))).toBe(true);
    expect(JSON.stringify(unknown)).not.toContain("visible-sentinel");
  });
});
