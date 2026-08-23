import {
  createSeededRng,
  deterministicHash,
  type ApplyActionInput,
  type ApplyResult,
  type GameModule,
  type InitGameInput,
  type InitResult,
  type LegalAction,
  type PlayerView,
  type PlayerViewInput,
  type TerminalResult
} from "@board-game-sim/shared";
import { createSignalCrewFaces, parseSignalCrewDefinition } from "./definition";
import { applyExhaustiveClue, createInitialCardKnowledge } from "./knowledge";
import type {
  CardKnowledge,
  SignalChannel,
  SignalCrewState,
  SignalCrewTerminalReason,
  SignalCrewView,
  SignalFace,
  SignalRank,
  SignalRelay,
  SignalSocket
} from "./types";

function shuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const rng = createSeededRng(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(rng() * (index + 1));
    [result[index], result[selected]] = [result[selected]!, result[index]!];
  }
  return result;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function opaquePacketId(seed: string, index: number): string {
  const body = Array.from({ length: 3 }, (_, part) => (
    deterministicHash(`${seed}:opaque:${part}:${index}`).slice(1).padStart(8, "0")
  )).join("");
  return `pkt_${body}`;
}

function sameFace(a: SignalFace, b: SignalFace): boolean {
  return a.channel === b.channel && a.rank === b.rank;
}

function reject(state: SignalCrewState, reason: string): ApplyResult<SignalCrewState> {
  return {
    accepted: false,
    reason,
    nextState: state,
    emittedEvents: [],
    nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
    integrityHash: deterministicHash(state)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCluePayload(value: unknown): value is {
  targetPlayerId: string;
  attribute: "channel" | "rank";
  value: SignalChannel | SignalRank;
} {
  if (!isRecord(value)) return false;
  return typeof value.targetPlayerId === "string"
    && (value.attribute === "channel" || value.attribute === "rank")
    && (typeof value.value === "string" || Number.isInteger(value.value));
}

function isPacketPayload(value: unknown): value is { packetId: string } {
  return isRecord(value) && typeof value.packetId === "string";
}

function isTransmissionPayload(value: unknown): value is { packetId: string; socketId: string } {
  return isRecord(value)
    && typeof value.packetId === "string"
    && typeof value.socketId === "string";
}

function openSockets(state: SignalCrewState): SignalSocket[] {
  return state.relays.flatMap((relay) => relay.sockets).filter((socket) => !socket.filledPacketId);
}

function clueChangesKnowledge(
  knowledge: Record<string, CardKnowledge>,
  next: Record<string, CardKnowledge>,
  packetIds: string[]
): boolean {
  return packetIds.some((packetId) => {
    const before = knowledge[packetId]!;
    const after = next[packetId]!;
    return before.possibleChannels.length !== after.possibleChannels.length
      || before.possibleRanks.length !== after.possibleRanks.length;
  });
}

function validClueValues(state: SignalCrewState, actorPlayerId: string): Array<{
  targetPlayerId: string;
  attribute: "channel" | "rank";
  value: SignalChannel | SignalRank;
}> {
  if (state.bandwidth === 0) return [];
  const values: Array<{
    targetPlayerId: string;
    attribute: "channel" | "rank";
    value: SignalChannel | SignalRank;
  }> = [];
  for (const targetPlayerId of state.players) {
    if (targetPlayerId === actorPlayerId) continue;
    const packetIds = state.hands[targetPlayerId]!;
    const candidates: Array<{ attribute: "channel" | "rank"; value: SignalChannel | SignalRank }> = [
      ...state.config.channels.map((channel) => ({ attribute: "channel" as const, value: channel.id })),
      ...state.config.ranks.map((rank) => ({ attribute: "rank" as const, value: rank }))
    ];
    for (const candidate of candidates) {
      if (!packetIds.some((packetId) => state.packetFaces[packetId]![candidate.attribute] === candidate.value)) continue;
      const next = applyExhaustiveClue({
        knowledge: state.knowledge[targetPlayerId]!,
        packetIds,
        packetFaces: state.packetFaces,
        ...candidate
      });
      if (clueChangesKnowledge(state.knowledge[targetPlayerId]!, next, packetIds)) {
        values.push({ targetPlayerId, ...candidate });
      }
    }
  }
  return values;
}

export function legalSignalCrewActionTypes(
  state: SignalCrewState,
  playerId: string
): SignalCrewView["legalActionTypes"] {
  if (state.phase !== "play" || state.currentPlayerId !== playerId) return [];
  const hand = state.hands[playerId]!;
  const actions: SignalCrewView["legalActionTypes"] = [];
  if (validClueValues(state, playerId).length > 0) actions.push("give_clue");
  if (hand.length > 0 && openSockets(state).length > 0) actions.push("transmit_packet");
  if (hand.length > 0 && state.bandwidth < state.maxBandwidth) actions.push("recycle_packet");
  if (actions.length === 0) actions.push("stand_by");
  return actions;
}

function drawPacket(
  state: SignalCrewState,
  playerId: string,
  events: ApplyResult<SignalCrewState>["emittedEvents"]
): boolean {
  const packetId = state.deck.shift();
  if (!packetId) return false;
  state.hands[playerId]!.push(packetId);
  state.knowledge[playerId]![packetId] = createInitialCardKnowledge(state.config);
  events.push({ eventType: "packet.drawn", payload: { playerId, packetId } });
  return state.deck.length === 0;
}

function requiredPacketExhausted(state: SignalCrewState): boolean {
  const available = [...state.deck, ...Object.values(state.hands).flat()];
  return openSockets(state).some((socket) => (
    !available.some((packetId) => sameFace(state.packetFaces[packetId]!, socket.required))
  ));
}

function terminalReason(state: SignalCrewState): SignalCrewTerminalReason | null {
  if (state.relays.every((relay) => relay.completed)) return "crew_victory";
  if (state.interference >= state.config.interferenceLimit) return "interference_overload";
  if (requiredPacketExhausted(state)) return "required_packet_exhausted";
  if (state.finalOrbitTurnsRemaining === 0) return "final_orbit_expired";
  return null;
}

function completeTurn(
  state: SignalCrewState,
  events: ApplyResult<SignalCrewState>["emittedEvents"],
  orbitActiveAtStart: boolean,
  drewFinalPacket: boolean
): void {
  state.turnIndex += 1;
  if (drewFinalPacket && state.finalOrbitTurnsRemaining === null) {
    state.finalOrbitTurnsRemaining = state.players.length;
    events.push({
      eventType: "final_orbit.started",
      payload: { turnsRemaining: state.finalOrbitTurnsRemaining }
    });
  } else if (orbitActiveAtStart) {
    state.finalOrbitTurnsRemaining = Math.max(0, state.finalOrbitTurnsRemaining! - 1);
  }

  const reason = terminalReason(state);
  if (reason) {
    state.phase = "terminal";
    state.outcome = reason === "crew_victory" ? "won" : "lost";
    state.terminalReason = reason;
    events.push({ eventType: "game.completed", payload: { outcome: state.outcome, reason } });
    return;
  }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.currentPlayerId = state.players[state.currentPlayerIndex]!;
}

export class SignalCrewModule implements GameModule<SignalCrewState> {
  initGame(input: InitGameInput): InitResult<SignalCrewState> {
    const config = parseSignalCrewDefinition(input.definition);
    if (input.players.length < config.minPlayers
      || input.players.length > config.maxPlayers
      || new Set(input.players).size !== input.players.length) {
      throw new Error("invalid_signal_crew_players");
    }
    const seats = input.players.length as 2 | 3 | 4;
    const uniqueFaces = createSignalCrewFaces(config).filter((face, index, faces) => (
      faces.findIndex((candidate) => sameFace(candidate, face)) === index
    ));
    const requirements = shuffle(uniqueFaces, `${input.seed}:mission`).slice(0, 10);
    const relays: SignalRelay[] = config.relayNames.map((name, relayIndex) => ({
      id: `relay-${relayIndex + 1}`,
      name,
      completed: false,
      sockets: Array.from({ length: config.socketsPerRelay }, (_, socketIndex) => ({
        id: `relay-${relayIndex + 1}-socket-${socketIndex + 1}`,
        required: requirements[relayIndex * config.socketsPerRelay + socketIndex]!,
        filledPacketId: null
      }))
    }));
    const shuffledFaces = shuffle(createSignalCrewFaces(config), `${input.seed}:deck`);
    const packetIds = shuffledFaces.map((_, index) => opaquePacketId(`${input.seed}:ids`, index));
    if (new Set(packetIds).size !== packetIds.length) throw new Error("signal_packet_id_collision");
    const packetFaces = Object.fromEntries(packetIds.map((packetId, index) => [packetId, shuffledFaces[index]!])) as Record<string, SignalFace>;
    const deck = [...packetIds];
    const hands = Object.fromEntries(input.players.map((playerId) => [
      playerId,
      deck.splice(0, config.handSize[seats])
    ]));
    const knowledge = Object.fromEntries(input.players.map((playerId) => [
      playerId,
      Object.fromEntries(hands[playerId]!.map((packetId) => [packetId, createInitialCardKnowledge(config)]))
    ]));
    const startPlayerIndex = Math.floor(createSeededRng(`${input.seed}:starter`)() * seats);
    const state: SignalCrewState = {
      phase: "play",
      outcome: "playing",
      terminalReason: null,
      config,
      players: [...input.players],
      packetFaces,
      deck,
      hands,
      discard: [],
      relays,
      knowledge,
      bandwidth: config.bandwidth[seats],
      maxBandwidth: config.bandwidth[seats],
      interference: 0,
      currentPlayerIndex: startPlayerIndex,
      currentPlayerId: input.players[startPlayerIndex]!,
      turnIndex: 0,
      finalOrbitTurnsRemaining: null
    };
    return {
      initialState: state,
      emittedEvents: [{
        eventType: "game.initialized",
        payload: {
          players: state.players,
          relays: state.relays,
          bandwidth: state.bandwidth,
          currentPlayerId: state.currentPlayerId
        }
      }],
      integrityHash: deterministicHash(state)
    };
  }

  listLegalActions(state: SignalCrewState, playerId: string): LegalAction[] {
    return legalSignalCrewActionTypes(state, playerId).map((actionType) => ({
      actionType,
      description: actionType.replaceAll("_", " ")
    }));
  }

  applyAction(input: ApplyActionInput<SignalCrewState>): ApplyResult<SignalCrewState> {
    if (input.state.phase !== "play") return reject(input.state, "terminal_state");
    if (input.actorPlayerId !== input.state.currentPlayerId) return reject(input.state, "not_your_turn");
    const orbitActiveAtStart = input.state.finalOrbitTurnsRemaining !== null;
    const legalTypes = legalSignalCrewActionTypes(input.state, input.actorPlayerId);
    if (!legalTypes.includes(input.actionType as never)) {
      if (input.actionType === "stand_by") return reject(input.state, "productive_action_available");
      if (!["give_clue", "transmit_packet", "recycle_packet"].includes(input.actionType)) {
        return reject(input.state, "unsupported_action");
      }
    }

    if (input.actionType === "give_clue") {
      if (!isCluePayload(input.payload)) return reject(input.state, "invalid_payload");
      const payload = input.payload;
      if (!input.state.players.includes(payload.targetPlayerId) || payload.targetPlayerId === input.actorPlayerId) {
        return reject(input.state, "invalid_clue_target");
      }
      if (input.state.bandwidth === 0) return reject(input.state, "bandwidth_empty");
      if (payload.attribute === "channel"
        ? !input.state.config.channels.some((channel) => channel.id === payload.value)
        : !input.state.config.ranks.includes(payload.value as SignalRank)) {
        return reject(input.state, "invalid_clue_value");
      }
      const packetIds = input.state.hands[payload.targetPlayerId]!;
      if (!packetIds.some((packetId) => input.state.packetFaces[packetId]![payload.attribute] === payload.value)) {
        return reject(input.state, "clue_matches_no_packets");
      }
      const updated = applyExhaustiveClue({
        knowledge: input.state.knowledge[payload.targetPlayerId]!,
        packetIds,
        packetFaces: input.state.packetFaces,
        attribute: payload.attribute,
        value: payload.value
      });
      if (!clueChangesKnowledge(input.state.knowledge[payload.targetPlayerId]!, updated, packetIds)) {
        return reject(input.state, "clue_adds_no_information");
      }
      const state = cloneValue(input.state);
      state.knowledge[payload.targetPlayerId] = updated;
      state.bandwidth -= 1;
      const matchingPacketIds = packetIds.filter((packetId) => (
        input.state.packetFaces[packetId]![payload.attribute] === payload.value
      ));
      const events: ApplyResult<SignalCrewState>["emittedEvents"] = [{
        eventType: "clue.given",
        payload: { ...payload, matchingPacketIds }
      }];
      completeTurn(state, events, orbitActiveAtStart, false);
      return this.accepted(state, events);
    }

    if (input.actionType === "transmit_packet") {
      if (!isTransmissionPayload(input.payload)) return reject(input.state, "invalid_payload");
      const payload = input.payload;
      if (!input.state.hands[input.actorPlayerId]!.includes(payload.packetId)) {
        return reject(input.state, "unknown_packet");
      }
      const socket = input.state.relays.flatMap((relay) => relay.sockets)
        .find((candidate) => candidate.id === payload.socketId);
      if (!socket) return reject(input.state, "unknown_socket");
      if (socket.filledPacketId) return reject(input.state, "socket_filled");
      const state = cloneValue(input.state);
      const hand = state.hands[input.actorPlayerId]!;
      hand.splice(hand.indexOf(payload.packetId), 1);
      delete state.knowledge[input.actorPlayerId]![payload.packetId];
      const face = state.packetFaces[payload.packetId]!;
      const targetRelay = state.relays.find((relay) => relay.sockets.some((candidate) => candidate.id === payload.socketId))!;
      const targetSocket = targetRelay.sockets.find((candidate) => candidate.id === payload.socketId)!;
      const matched = sameFace(face, targetSocket.required);
      const events: ApplyResult<SignalCrewState>["emittedEvents"] = [{
        eventType: "packet.transmitted",
        payload: {
          playerId: input.actorPlayerId,
          packetId: payload.packetId,
          socketId: payload.socketId,
          relayId: targetRelay.id,
          face,
          matched
        }
      }];
      if (matched) {
        targetSocket.filledPacketId = payload.packetId;
        const wasComplete = targetRelay.completed;
        targetRelay.completed = targetRelay.sockets.every((candidate) => candidate.filledPacketId !== null);
        if (!wasComplete && targetRelay.completed) {
          state.bandwidth = Math.min(state.maxBandwidth, state.bandwidth + state.config.relayBandwidthReward);
          events.push({ eventType: "relay.completed", payload: { relayId: targetRelay.id } });
        }
      } else {
        state.discard.push({ packetId: payload.packetId, face, reason: "failed_transmission" });
        state.interference += 1;
      }
      const drewFinalPacket = drawPacket(state, input.actorPlayerId, events);
      completeTurn(state, events, orbitActiveAtStart, drewFinalPacket);
      return this.accepted(state, events);
    }

    if (input.actionType === "recycle_packet") {
      if (!isPacketPayload(input.payload)) return reject(input.state, "invalid_payload");
      const packetId = input.payload.packetId;
      if (!input.state.hands[input.actorPlayerId]!.includes(packetId)) return reject(input.state, "unknown_packet");
      if (input.state.bandwidth >= input.state.maxBandwidth) return reject(input.state, "bandwidth_full");
      const state = cloneValue(input.state);
      const hand = state.hands[input.actorPlayerId]!;
      hand.splice(hand.indexOf(packetId), 1);
      delete state.knowledge[input.actorPlayerId]![packetId];
      const face = state.packetFaces[packetId]!;
      state.discard.push({ packetId, face, reason: "recycled" });
      state.bandwidth += 1;
      const events: ApplyResult<SignalCrewState>["emittedEvents"] = [{
        eventType: "packet.recycled",
        payload: { playerId: input.actorPlayerId, packetId, face }
      }];
      const drewFinalPacket = drawPacket(state, input.actorPlayerId, events);
      completeTurn(state, events, orbitActiveAtStart, drewFinalPacket);
      return this.accepted(state, events);
    }

    if (input.actionType === "stand_by") {
      const state = cloneValue(input.state);
      const events: ApplyResult<SignalCrewState>["emittedEvents"] = [{
        eventType: "crew.stood_by",
        payload: { playerId: input.actorPlayerId }
      }];
      completeTurn(state, events, orbitActiveAtStart, false);
      return this.accepted(state, events);
    }

    return reject(input.state, "unsupported_action");
  }

  getPlayerView(input: PlayerViewInput<SignalCrewState>): PlayerView {
    const state = input.state;
    const seated = state.players.includes(input.playerId);
    const hands = state.players.map((playerId) => ({
      playerId,
      packets: state.hands[playerId]!.map((packetId) => {
        const knowledge = state.knowledge[playerId]![packetId]!;
        if (seated && playerId !== input.playerId) {
          return { packetId, concealed: false as const, face: state.packetFaces[packetId]!, ...knowledge };
        }
        return { packetId, concealed: true as const, ...knowledge };
      })
    }));
    const canAct = seated && state.phase === "play" && state.currentPlayerId === input.playerId;
    const view: SignalCrewView = {
      phase: state.phase,
      outcome: state.outcome,
      terminalReason: state.terminalReason,
      config: state.config,
      players: state.players,
      hands,
      relays: state.relays,
      discard: state.discard,
      bandwidth: state.bandwidth,
      maxBandwidth: state.maxBandwidth,
      interference: state.interference,
      currentPlayerId: state.currentPlayerId,
      turnIndex: state.turnIndex,
      finalOrbitTurnsRemaining: state.finalOrbitTurnsRemaining,
      remainingPacketCount: state.deck.length,
      youPlayerId: seated ? input.playerId : null,
      canAct,
      legalActionTypes: canAct ? legalSignalCrewActionTypes(state, input.playerId) : []
    };
    return { visibleState: cloneValue(view) as unknown as PlayerView["visibleState"] };
  }

  isTerminal(state: SignalCrewState): TerminalResult | null {
    if (state.phase !== "terminal" || !state.terminalReason) return null;
    return { winnerPlayerId: null, reason: state.terminalReason };
  }

  private accepted(
    state: SignalCrewState,
    events: ApplyResult<SignalCrewState>["emittedEvents"]
  ): ApplyResult<SignalCrewState> {
    return {
      accepted: true,
      nextState: state,
      emittedEvents: events,
      nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
      integrityHash: deterministicHash(state)
    };
  }
}
