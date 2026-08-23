import {
  axialKey,
  axialNeighbors,
  coordinatesInRadius,
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
import { createHexKingdomsTiles, parseHexKingdomsDefinition } from "./definition";
import { rankHexKingdoms, scoreHexKingdoms } from "./scoring";
import type { HexKingdomsState, HexKingdomsView, HexPlacement, HexTile } from "./types";

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

function reject(state: HexKingdomsState, reason: string): ApplyResult<HexKingdomsState> {
  return {
    accepted: false,
    reason,
    nextState: state,
    emittedEvents: [],
    nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
    integrityHash: deterministicHash(state)
  };
}

function occupiedKeys(state: HexKingdomsState): Set<string> {
  return new Set([
    ...Object.values(state.capitals).map(axialKey),
    ...state.landmarks.map(axialKey),
    ...state.placements.map((placement) => axialKey(placement.coordinate))
  ]);
}

export function legalHexKingdomsCoordinates(state: HexKingdomsState): Array<{ q: number; r: number }> {
  if (state.phase !== "play") return [];
  const layout = state.config.layouts[state.players.length as 2 | 3 | 4];
  const occupied = occupiedKeys(state);
  return coordinatesInRadius(layout.radius).filter((coordinate) => {
    const key = axialKey(coordinate);
    return !occupied.has(key)
      && axialNeighbors(coordinate).some((neighbor) => occupied.has(axialKey(neighbor)));
  });
}

function isPayload(value: unknown): value is { marketTileId: string; q: number; r: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.marketTileId === "string"
    && Number.isInteger(payload.q)
    && Number.isInteger(payload.r);
}

export class HexKingdomsModule implements GameModule<HexKingdomsState> {
  initGame(input: InitGameInput): InitResult<HexKingdomsState> {
    const config = parseHexKingdomsDefinition(input.definition);
    if (input.players.length < config.minPlayers
      || input.players.length > config.maxPlayers
      || new Set(input.players).size !== input.players.length) {
      throw new Error("invalid_hex_kingdoms_players");
    }
    const playerCount = input.players.length as 2 | 3 | 4;
    const layout = config.layouts[playerCount];
    const deck = shuffle(createHexKingdomsTiles(config), `${input.seed}:tiles`);
    const market = deck.splice(0, config.marketSize);
    const startPlayerIndex = Math.floor(createSeededRng(`${input.seed}:starter`)() * playerCount);
    const capitals = Object.fromEntries(input.players.map((playerId, index) => [
      playerId,
      layout.capitals[index]!
    ]));
    const state: HexKingdomsState = {
      phase: "play",
      config,
      players: [...input.players],
      capitals,
      landmarks: layout.landmarks,
      market,
      drawPile: deck,
      placements: [],
      startPlayerIndex,
      currentPlayerId: input.players[startPlayerIndex]!,
      turnIndex: 0,
      scores: {},
      winnerPlayerIds: [],
      winnerPlayerId: null
    };
    state.scores = scoreHexKingdoms({
      players: state.players,
      capitals: state.capitals,
      landmarks: state.landmarks,
      placements: state.placements,
      scoring: state.config.scoring
    });
    return {
      initialState: state,
      emittedEvents: [{
        eventType: "game.initialized",
        payload: {
          players: state.players,
          currentPlayerId: state.currentPlayerId,
          market: state.market
        }
      }],
      integrityHash: deterministicHash(state)
    };
  }

  listLegalActions(state: HexKingdomsState, playerId: string): LegalAction[] {
    if (state.phase !== "play" || state.currentPlayerId !== playerId) return [];
    return [{ actionType: "draft_and_place", description: "Draft a market tile and place it on a legal hex" }];
  }

  applyAction(input: ApplyActionInput<HexKingdomsState>): ApplyResult<HexKingdomsState> {
    if (input.state.phase !== "play") return reject(input.state, "terminal_state");
    if (input.actorPlayerId !== input.state.currentPlayerId) return reject(input.state, "not_your_turn");
    if (input.actionType !== "draft_and_place") return reject(input.state, "unsupported_action");
    if (!isPayload(input.payload)) return reject(input.state, "invalid_payload");

    const payload = input.payload;
    const tileIndex = input.state.market.findIndex((tile) => tile.id === payload.marketTileId);
    if (tileIndex < 0) return reject(input.state, "unknown_market_tile");
    const coordinate = { q: payload.q, r: payload.r };
    const legalKeys = new Set(legalHexKingdomsCoordinates(input.state).map(axialKey));
    if (!legalKeys.has(axialKey(coordinate))) return reject(input.state, "illegal_coordinate");

    const state = cloneValue(input.state);
    const [tile] = state.market.splice(tileIndex, 1) as [HexTile];
    const placement: HexPlacement = {
      tileId: tile.id,
      ownerPlayerId: input.actorPlayerId,
      coordinate,
      terrain: tile.terrain,
      feature: tile.feature
    };
    state.placements.push(placement);
    state.turnIndex += 1;
    const events: ApplyResult<HexKingdomsState>["emittedEvents"] = [{
      eventType: "tile.placed",
      payload: placement
    }];
    const refill = state.drawPile.shift();
    if (refill) {
      state.market.push(refill);
      events.push({ eventType: "market.refilled", payload: { tile: refill } });
    }
    state.scores = scoreHexKingdoms({
      players: state.players,
      capitals: state.capitals,
      landmarks: state.landmarks,
      placements: state.placements,
      scoring: state.config.scoring
    });
    events.push({ eventType: "scores.updated", payload: { scores: state.scores } });

    const turnsTotal = state.players.length * state.config.turnsPerPlayer;
    if (state.turnIndex === turnsTotal) {
      const ranking = rankHexKingdoms(state.scores);
      state.phase = "terminal";
      state.winnerPlayerIds = ranking.winnerPlayerIds;
      state.winnerPlayerId = ranking.winnerPlayerId;
      events.push({
        eventType: "game.completed",
        payload: { winnerPlayerIds: state.winnerPlayerIds, scores: state.scores }
      });
    } else {
      const activeOffset = state.turnIndex % state.players.length;
      state.currentPlayerId = state.players[(state.startPlayerIndex + activeOffset) % state.players.length]!;
    }

    return {
      accepted: true,
      nextState: state,
      emittedEvents: events,
      nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
      integrityHash: deterministicHash(state)
    };
  }

  getPlayerView(input: PlayerViewInput<HexKingdomsState>): PlayerView {
    const state = input.state;
    const canAct = state.phase === "play" && state.currentPlayerId === input.playerId;
    const view: HexKingdomsView = {
      phase: state.phase,
      config: state.config,
      players: state.players,
      capitals: state.capitals,
      landmarks: state.landmarks,
      market: state.market,
      placements: state.placements,
      currentPlayerId: state.currentPlayerId,
      turnIndex: state.turnIndex,
      round: Math.min(
        state.config.turnsPerPlayer,
        Math.floor(state.turnIndex / state.players.length) + 1
      ),
      turnsTotal: state.players.length * state.config.turnsPerPlayer,
      remainingTileCount: state.drawPile.length,
      scores: state.scores,
      winnerPlayerIds: state.winnerPlayerIds,
      winnerPlayerId: state.winnerPlayerId,
      youPlayerId: input.playerId,
      canAct,
      legalCoordinates: canAct ? legalHexKingdomsCoordinates(state) : []
    };
    return { visibleState: cloneValue(view) as unknown as PlayerView["visibleState"] };
  }

  isTerminal(state: HexKingdomsState): TerminalResult | null {
    if (state.phase !== "terminal") return null;
    return { winnerPlayerId: state.winnerPlayerId, reason: "kingdoms_scored" };
  }
}
