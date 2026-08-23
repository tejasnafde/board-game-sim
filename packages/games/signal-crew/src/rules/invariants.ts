import { createSignalCrewFaces } from "./definition";
import type { SignalCrewState, SignalFace } from "./types";

function faceKey(face: SignalFace): string {
  return `${face.channel}:${face.rank}`;
}

export function assertSignalCrewInvariants(state: SignalCrewState): void {
  const located = [
    ...state.deck,
    ...Object.values(state.hands).flat(),
    ...state.discard.map((packet) => packet.packetId),
    ...state.relays.flatMap((relay) => relay.sockets.flatMap((socket) => (
      socket.filledPacketId ? [socket.filledPacketId] : []
    )))
  ];
  if (located.length !== 32 || new Set(located).size !== 32) throw new Error("signal_packet_conservation");
  if (Object.keys(state.packetFaces).length !== 32
    || located.some((packetId) => !state.packetFaces[packetId])) throw new Error("signal_packet_face_missing");

  const expectedFaces = createSignalCrewFaces(state.config).map(faceKey).sort();
  const actualFaces = Object.values(state.packetFaces).map(faceKey).sort();
  if (JSON.stringify(expectedFaces) !== JSON.stringify(actualFaces)) throw new Error("signal_face_conservation");
  if (state.relays.length !== 5
    || state.relays.flatMap((relay) => relay.sockets).length !== 10
    || new Set(state.relays.flatMap((relay) => relay.sockets.map((socket) => faceKey(socket.required)))).size !== 10) {
    throw new Error("signal_relay_invariant");
  }
  for (const relay of state.relays) {
    for (const socket of relay.sockets) {
      if (socket.filledPacketId && faceKey(state.packetFaces[socket.filledPacketId]!) !== faceKey(socket.required)) {
        throw new Error("signal_socket_mismatch");
      }
    }
    if (relay.completed !== relay.sockets.every((socket) => socket.filledPacketId !== null)) {
      throw new Error("signal_relay_completion_mismatch");
    }
  }
  if (state.bandwidth < 0 || state.bandwidth > state.maxBandwidth) throw new Error("signal_bandwidth_bounds");
  if (state.interference < 0 || state.interference > state.config.interferenceLimit) {
    throw new Error("signal_interference_bounds");
  }
  for (const playerId of state.players) {
    for (const packetId of state.hands[playerId]!) {
      const face = state.packetFaces[packetId]!;
      const knowledge = state.knowledge[playerId]![packetId];
      if (!knowledge
        || !knowledge.possibleChannels.includes(face.channel)
        || !knowledge.possibleRanks.includes(face.rank)) {
        throw new Error("signal_knowledge_unsound");
      }
    }
    const held = new Set(state.hands[playerId]);
    if (Object.keys(state.knowledge[playerId]!).some((packetId) => !held.has(packetId))) {
      throw new Error("signal_stale_knowledge");
    }
  }
  if (state.phase === "play" && !state.players.includes(state.currentPlayerId)) {
    throw new Error("signal_current_player_invalid");
  }
}
