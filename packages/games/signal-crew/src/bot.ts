import type { BotAction, GameBot, JsonValue } from "@board-game-sim/shared";
import { possibleSignalFaces } from "./rules/knowledge";
import type {
  ConcealedPacketView,
  SignalChannel,
  SignalCrewView,
  SignalFace,
  SignalRank,
  VisiblePacketView
} from "./rules/types";

function sameFace(a: SignalFace, b: SignalFace): boolean {
  return a.channel === b.channel && a.rank === b.rank;
}

function choose<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

function action(actionType: string, payload: Record<string, JsonValue>): BotAction {
  return { actionType, payload };
}

function clueCandidates(game: SignalCrewView, playerId: string) {
  const required = game.relays.flatMap((relay) => relay.sockets)
    .filter((socket) => !socket.filledPacketId)
    .map((socket) => socket.required);
  const result: Array<{
    targetPlayerId: string;
    attribute: "channel" | "rank";
    value: SignalChannel | SignalRank;
    gain: number;
    certainty: number;
    relevance: number;
  }> = [];
  for (const hand of game.hands) {
    if (hand.playerId === playerId) continue;
    const packets = hand.packets as VisiblePacketView[];
    const values: Array<{ attribute: "channel" | "rank"; value: SignalChannel | SignalRank }> = [
      ...game.config.channels.map((channel) => ({ attribute: "channel" as const, value: channel.id })),
      ...game.config.ranks.map((rank) => ({ attribute: "rank" as const, value: rank }))
    ];
    for (const candidate of values) {
      if (!packets.some((packet) => packet.face[candidate.attribute] === candidate.value)) continue;
      let gain = 0;
      let certainty = 0;
      let relevance = 0;
      for (const packet of packets) {
        const matches = packet.face[candidate.attribute] === candidate.value;
        const current = candidate.attribute === "channel" ? packet.possibleChannels : packet.possibleRanks;
        const nextLength = matches ? 1 : current.filter((value) => value !== candidate.value).length;
        gain += Math.max(0, current.length - nextLength);
        const otherLength = candidate.attribute === "channel"
          ? packet.possibleRanks.length
          : packet.possibleChannels.length;
        if (nextLength === 1 && otherLength === 1 && current.length > 1) certainty += 1;
        if (required.some((face) => sameFace(face, packet.face)) && current.length > nextLength) relevance += 1;
      }
      if (gain > 0) result.push({ targetPlayerId: hand.playerId, ...candidate, gain, certainty, relevance });
    }
  }
  return result;
}

function deducedFaces(game: SignalCrewView, packet: ConcealedPacketView): SignalFace[] {
  const seen = new Map<string, number>();
  const add = (face: SignalFace) => {
    const key = `${face.channel}:${face.rank}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  };
  for (const hand of game.hands) {
    for (const candidate of hand.packets) {
      if (!candidate.concealed) add(candidate.face);
    }
  }
  for (const discarded of game.discard) add(discarded.face);
  for (const relay of game.relays) {
    for (const socket of relay.sockets) {
      if (socket.filledPacketId) add(socket.required);
    }
  }
  return possibleSignalFaces(packet).filter((face) => (
    (seen.get(`${face.channel}:${face.rank}`) ?? 0) < game.config.copiesPerFace
  ));
}

export const signalCrewBot: GameBot = ({ view, playerId, rng }) => {
  const game = view as unknown as SignalCrewView;
  if (game.phase !== "play" || !game.canAct || game.currentPlayerId !== playerId) return null;
  const ownHand = game.hands.find((hand) => hand.playerId === playerId);
  const ownPackets = (ownHand?.packets ?? []) as ConcealedPacketView[];
  const openSockets = game.relays.flatMap((relay) => relay.sockets).filter((socket) => !socket.filledPacketId);

  if (game.legalActionTypes.includes("transmit_packet")) {
    const certain = ownPackets.flatMap((packet) => {
      const faces = deducedFaces(game, packet);
      if (faces.length !== 1) return [];
      return openSockets
        .filter((socket) => sameFace(faces[0]!, socket.required))
        .map((socket) => ({ packet, socket }));
    });
    if (certain.length > 0) {
      const selected = choose(certain, rng);
      return action("transmit_packet", { packetId: selected.packet.packetId, socketId: selected.socket.id });
    }
  }

  const clues = game.legalActionTypes.includes("give_clue") ? clueCandidates(game, playerId) : [];
  const certaintyClues = clues.filter((clue) => clue.certainty > 0);
  if (certaintyClues.length > 0) {
    const bestCertainty = Math.max(...certaintyClues.map((clue) => (
      clue.certainty * 100 + clue.relevance * 10 + clue.gain
    )));
    const selected = choose(
      certaintyClues.filter((clue) => (
        clue.certainty * 100 + clue.relevance * 10 + clue.gain === bestCertainty
      )),
      rng
    );
    return action("give_clue", {
      targetPlayerId: selected.targetPlayerId,
      attribute: selected.attribute,
      value: selected.value
    });
  }

  if (game.legalActionTypes.includes("recycle_packet")) {
    const safe = ownPackets.filter((packet) => (
      deducedFaces(game, packet).every((face) => (
        !openSockets.some((socket) => sameFace(face, socket.required))
      ))
    ));
    if (safe.length > 0) {
      return action("recycle_packet", { packetId: choose(safe, rng).packetId });
    }
  }

  if (clues.length > 0) {
    const bestGain = Math.max(...clues.map((clue) => clue.relevance * 10 + clue.gain));
    const selected = choose(clues.filter((clue) => clue.relevance * 10 + clue.gain === bestGain), rng);
    return action("give_clue", {
      targetPlayerId: selected.targetPlayerId,
      attribute: selected.attribute,
      value: selected.value
    });
  }

  if (game.legalActionTypes.includes("transmit_packet") && ownPackets.length > 0 && openSockets.length > 0) {
    const candidates = ownPackets.flatMap((packet) => {
      const possible = deducedFaces(game, packet);
      return openSockets.map((socket) => ({
        packet,
        socket,
        confidence: possible.filter((face) => sameFace(face, socket.required)).length / possible.length
      }));
    });
    const highest = Math.max(...candidates.map((candidate) => candidate.confidence));
    const selected = choose(candidates.filter((candidate) => candidate.confidence === highest), rng);
    return action("transmit_packet", { packetId: selected.packet.packetId, socketId: selected.socket.id });
  }

  if (game.legalActionTypes.includes("recycle_packet") && ownPackets.length > 0) {
    return action("recycle_packet", { packetId: choose(ownPackets, rng).packetId });
  }
  if (game.legalActionTypes.includes("stand_by")) return action("stand_by", {});
  return null;
};
