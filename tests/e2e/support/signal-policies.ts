import type { BotAction, GameBot } from "@board-game-sim/shared";
import type {
  SignalChannel,
  SignalCrewView,
  SignalRank,
  VisiblePacketView
} from "@board-game-sim/signal-crew";

function clue(game: SignalCrewView, playerId: string): BotAction | null {
  for (const hand of game.hands) {
    if (hand.playerId === playerId) continue;
    const packets = hand.packets as VisiblePacketView[];
    const candidates: Array<{ attribute: "channel" | "rank"; value: SignalChannel | SignalRank }> = [
      ...game.config.channels.map((channel) => ({ attribute: "channel" as const, value: channel.id })),
      ...game.config.ranks.map((rank) => ({ attribute: "rank" as const, value: rank }))
    ];
    for (const candidate of candidates) {
      if (!packets.some((packet) => packet.face[candidate.attribute] === candidate.value)) continue;
      const changes = packets.some((packet) => {
        const possible = candidate.attribute === "channel" ? packet.possibleChannels : packet.possibleRanks;
        const matches = packet.face[candidate.attribute] === candidate.value;
        return matches ? possible.length > 1 : possible.includes(candidate.value as never);
      });
      if (changes) {
        return {
          actionType: "give_clue",
          payload: { targetPlayerId: hand.playerId, attribute: candidate.attribute, value: candidate.value }
        };
      }
    }
  }
  return null;
}

function transmit(game: SignalCrewView, playerId: string): BotAction | null {
  const packet = game.hands.find((hand) => hand.playerId === playerId)?.packets[0];
  const socket = game.relays.flatMap((relay) => relay.sockets).find((candidate) => !candidate.filledPacketId);
  return packet && socket
    ? { actionType: "transmit_packet", payload: { packetId: packet.packetId, socketId: socket.id } }
    : null;
}

function recycle(game: SignalCrewView, playerId: string): BotAction | null {
  const packet = game.hands.find((hand) => hand.playerId === playerId)?.packets[0];
  return packet ? { actionType: "recycle_packet", payload: { packetId: packet.packetId } } : null;
}

export const clueFirstSignalPolicy: GameBot = ({ view, playerId }) => {
  const game = view as unknown as SignalCrewView;
  if (!game.canAct || game.currentPlayerId !== playerId) return null;
  if (game.legalActionTypes.includes("give_clue")) {
    const action = clue(game, playerId);
    if (action) return action;
  }
  if (game.legalActionTypes.includes("transmit_packet")) return transmit(game, playerId);
  if (game.legalActionTypes.includes("recycle_packet")) return recycle(game, playerId);
  return game.legalActionTypes.includes("stand_by") ? { actionType: "stand_by", payload: {} } : null;
};

export const transmitFirstSignalPolicy: GameBot = ({ view, playerId }) => {
  const game = view as unknown as SignalCrewView;
  if (!game.canAct || game.currentPlayerId !== playerId) return null;
  if (game.legalActionTypes.includes("transmit_packet")) return transmit(game, playerId);
  if (game.legalActionTypes.includes("give_clue")) return clue(game, playerId);
  if (game.legalActionTypes.includes("recycle_packet")) return recycle(game, playerId);
  return game.legalActionTypes.includes("stand_by") ? { actionType: "stand_by", payload: {} } : null;
};

export const recycleFirstSignalPolicy: GameBot = ({ view, playerId }) => {
  const game = view as unknown as SignalCrewView;
  if (!game.canAct || game.currentPlayerId !== playerId) return null;
  if (game.legalActionTypes.includes("recycle_packet")) return recycle(game, playerId);
  if (game.legalActionTypes.includes("give_clue")) return clue(game, playerId);
  if (game.legalActionTypes.includes("transmit_packet")) return transmit(game, playerId);
  return game.legalActionTypes.includes("stand_by") ? { actionType: "stand_by", payload: {} } : null;
};

export const SIGNAL_TEST_POLICIES = [
  clueFirstSignalPolicy,
  transmitFirstSignalPolicy,
  recycleFirstSignalPolicy
] as const;
