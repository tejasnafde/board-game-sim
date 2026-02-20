import {
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
import type { BattleshipPlayerState, BattleshipState, Coord, ShipPlacement } from "./types";

type PlaceShipsPayload = { placements: ShipPlacement[] };
type FirePayload = Coord;

function inBounds(c: Coord): boolean {
  return c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10;
}

function coordKey(c: Coord): string {
  return `${c.row}:${c.col}`;
}

function cloneState(state: BattleshipState): BattleshipState {
  return JSON.parse(JSON.stringify(state)) as BattleshipState;
}

function getOpponent(state: BattleshipState, playerId: string): BattleshipPlayerState {
  const opponent = state.players.find((p) => p.playerId !== playerId);
  if (!opponent) throw new Error("opponent_missing");
  return opponent;
}

export class BattleshipModule implements GameModule<BattleshipState> {
  initGame(input: InitGameInput): InitResult<BattleshipState> {
    const players = input.players.map((playerId) => ({
      playerId,
      ships: [],
      shotsFired: [],
      hitsTaken: [],
      setupComplete: false
    }));

    const state: BattleshipState = {
      phase: "setup",
      players,
      currentPlayerId: input.players[0],
      winnerPlayerId: null
    };

    return {
      initialState: state,
      emittedEvents: [{ eventType: "game.initialized", payload: { players: input.players } }],
      integrityHash: deterministicHash(state)
    };
  }

  listLegalActions(state: BattleshipState, playerId: string): LegalAction[] {
    if (state.phase === "setup") {
      const player = state.players.find((p) => p.playerId === playerId);
      if (player?.setupComplete) return [];
      return [{ actionType: "place_ships", description: "Submit initial ship layout" }];
    }
    if (state.phase === "play" && state.currentPlayerId === playerId) {
      return [{ actionType: "fire", description: "Fire at one board coordinate" }];
    }
    return [];
  }

  applyAction(input: ApplyActionInput<BattleshipState>): ApplyResult<BattleshipState> {
    const state = cloneState(input.state);

    if (state.phase === "terminal") {
      return {
        accepted: false,
        reason: "terminal_state",
        nextState: state,
        emittedEvents: [],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    const actor = state.players.find((p) => p.playerId === input.actorPlayerId);
    if (!actor) {
      return {
        accepted: false,
        reason: "unknown_actor",
        nextState: state,
        emittedEvents: [],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    if (input.actionType === "place_ships" && state.phase === "setup") {
      if (actor.setupComplete) {
        return {
          accepted: false,
          reason: "setup_already_complete",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const payload = input.payload as unknown as PlaceShipsPayload;
      const seen = new Set<string>();
      for (const placement of payload.placements ?? []) {
        for (const cell of placement.cells) {
          if (!inBounds(cell)) {
            return {
              accepted: false,
              reason: "placement_out_of_bounds",
              nextState: state,
              emittedEvents: [],
              nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
              integrityHash: deterministicHash(state)
            };
          }
          const key = coordKey(cell);
          if (seen.has(key)) {
            return {
              accepted: false,
              reason: "placement_overlap",
              nextState: state,
              emittedEvents: [],
              nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
              integrityHash: deterministicHash(state)
            };
          }
          seen.add(key);
        }
      }

      actor.ships = payload.placements ?? [];
      actor.setupComplete = true;

      const allReady = state.players.every((p) => p.setupComplete);
      if (allReady) {
        state.phase = "play";
        state.currentPlayerId = state.players[0].playerId;
      }

      return {
        accepted: true,
        nextState: state,
        emittedEvents: [
          { eventType: "setup.completed", payload: { playerId: input.actorPlayerId } },
          ...(allReady ? [{ eventType: "phase.changed", payload: { phase: "play" } }] : [])
        ],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    if (input.actionType === "fire" && state.phase === "play") {
      if (state.currentPlayerId !== input.actorPlayerId) {
        return {
          accepted: false,
          reason: "not_your_turn",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const target = input.payload as unknown as FirePayload;
      if (!inBounds(target)) {
        return {
          accepted: false,
          reason: "shot_out_of_bounds",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const key = coordKey(target);
      if (actor.shotsFired.some((s) => coordKey(s) === key)) {
        return {
          accepted: false,
          reason: "duplicate_shot",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      actor.shotsFired.push(target);
      const opponent = getOpponent(state, input.actorPlayerId);
      const opponentShipCells = opponent.ships.flatMap((ship) => ship.cells.map(coordKey));
      const isHit = opponentShipCells.includes(key);
      if (isHit) {
        opponent.hitsTaken.push(target);
      }

      const remainingCells = opponent.ships
        .flatMap((ship) => ship.cells)
        .filter((cell) => !opponent.hitsTaken.some((hit) => coordKey(hit) === coordKey(cell)));

      const events = [{ eventType: "shot.resolved", payload: { at: target, hit: isHit } }];
      if (remainingCells.length === 0) {
        state.phase = "terminal";
        state.winnerPlayerId = actor.playerId;
        events.push({ eventType: "game.ended", payload: { winnerPlayerId: actor.playerId } });
      } else {
        state.currentPlayerId = opponent.playerId;
      }

      return {
        accepted: true,
        nextState: state,
        emittedEvents: events,
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    return {
      accepted: false,
      reason: "unsupported_action",
      nextState: state,
      emittedEvents: [],
      nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
      integrityHash: deterministicHash(state)
    };
  }

  getPlayerView(input: PlayerViewInput<BattleshipState>): PlayerView {
    const state = cloneState(input.state);
    const visiblePlayers = state.players.map((player) => {
      if (player.playerId === input.playerId) return player;
      return {
        ...player,
        ships: player.ships.map((ship) => ({
          shipId: ship.shipId,
          cells: ship.cells.filter((cell) => player.hitsTaken.some((h) => coordKey(h) === coordKey(cell)))
        }))
      };
    });

    return {
      visibleState: {
        ...state,
        players: visiblePlayers
      }
    };
  }

  isTerminal(state: BattleshipState): TerminalResult | null {
    if (state.phase !== "terminal") return null;
    return {
      winnerPlayerId: state.winnerPlayerId,
      reason: "all_opponent_ships_sunk"
    };
  }
}
