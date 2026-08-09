import {
  deterministicHash,
  type ApplyActionInput,
  type ApplyResult,
  type DomainEvent,
  type GameModule,
  type InitGameInput,
  type InitResult,
  type LegalAction,
  type PlayerView,
  type PlayerViewInput,
  type TerminalResult
} from "@board-game-sim/shared";
import type {
  BattleshipConfig,
  BattleshipPlayerState,
  BattleshipShipSpec,
  BattleshipState,
  Coord,
  ShipPlacement
} from "./types";

type PlaceShipsPayload = { placements: ShipPlacement[] };
type FirePayload = Coord;

type BattleshipDefinition = {
  board?: { rows?: number; cols?: number };
  ships?: BattleshipShipSpec[];
};

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

function inBounds(c: Coord, config: BattleshipConfig): boolean {
  return c.row >= 0 && c.row < config.rows && c.col >= 0 && c.col < config.cols;
}

function isStraightContiguous(cells: Coord[]): boolean {
  if (cells.length < 2) {
    return true;
  }

  const sameRow = cells.every((cell) => cell.row === cells[0]?.row);
  const sameCol = cells.every((cell) => cell.col === cells[0]?.col);
  if (!sameRow && !sameCol) {
    return false;
  }

  if (sameRow) {
    const cols = cells.map((c) => c.col).sort((a, b) => a - b);
    for (let i = 1; i < cols.length; i += 1) {
      if ((cols[i] ?? 0) - (cols[i - 1] ?? 0) !== 1) {
        return false;
      }
    }
    return true;
  }

  const rows = cells.map((c) => c.row).sort((a, b) => a - b);
  for (let i = 1; i < rows.length; i += 1) {
    if ((rows[i] ?? 0) - (rows[i - 1] ?? 0) !== 1) {
      return false;
    }
  }
  return true;
}

function parseConfig(definition: BattleshipDefinition): BattleshipConfig {
  const rows = definition.board?.rows ?? 10;
  const cols = definition.board?.cols ?? 10;
  const ships = definition.ships ?? [];

  return {
    rows,
    cols,
    ships
  };
}

function validatePlacements(
  placements: ShipPlacement[],
  config: BattleshipConfig
): { ok: true } | { ok: false; reason: string } {
  const specsById = new Map(config.ships.map((ship) => [ship.id, ship.size]));

  if (placements.length !== config.ships.length) {
    return { ok: false, reason: "invalid_ship_set" };
  }

  const shipIds = placements.map((placement) => placement.shipId);
  const uniqueShipIds = new Set(shipIds);
  if (uniqueShipIds.size !== placements.length) {
    return { ok: false, reason: "duplicate_ship_id" };
  }

  for (const shipId of uniqueShipIds) {
    if (!specsById.has(shipId)) {
      return { ok: false, reason: "unknown_ship_id" };
    }
  }

  const usedCells = new Set<string>();
  for (const placement of placements) {
    const expectedSize = specsById.get(placement.shipId);
    if (!expectedSize || placement.cells.length !== expectedSize) {
      return { ok: false, reason: "invalid_ship_size" };
    }

    if (!isStraightContiguous(placement.cells)) {
      return { ok: false, reason: "invalid_ship_shape" };
    }

    for (const cell of placement.cells) {
      if (!inBounds(cell, config)) {
        return { ok: false, reason: "placement_out_of_bounds" };
      }
      const key = coordKey(cell);
      if (usedCells.has(key)) {
        return { ok: false, reason: "placement_overlap" };
      }
      usedCells.add(key);
    }
  }

  return { ok: true };
}

function getShipByCell(player: BattleshipPlayerState, target: Coord): ShipPlacement | null {
  const key = coordKey(target);
  return player.ships.find((ship) => ship.cells.some((cell) => coordKey(cell) === key)) ?? null;
}

function isShipSunk(player: BattleshipPlayerState, ship: ShipPlacement): boolean {
  return ship.cells.every((cell) => player.hitsTaken.some((hit) => coordKey(hit) === coordKey(cell)));
}

export class BattleshipModule implements GameModule<BattleshipState> {
  initGame(input: InitGameInput): InitResult<BattleshipState> {
    const config = parseConfig(input.definition as unknown as BattleshipDefinition);

    const players = input.players.map((playerId) => ({
      playerId,
      ships: [],
      shotsFired: [],
      hitsTaken: [],
      sunkShipIds: [],
      setupComplete: false
    }));

    const state: BattleshipState = {
      phase: "setup",
      config,
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
      const placements = payload.placements ?? [];
      const validation = validatePlacements(placements, state.config);
      if (!validation.ok) {
        return {
          accepted: false,
          reason: validation.reason,
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      actor.ships = placements;
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
      if (!inBounds(target, state.config)) {
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
      const hitShip = getShipByCell(opponent, target);
      const events: DomainEvent[] = [];

      if (hitShip) {
        opponent.hitsTaken.push(target);
        events.push({ eventType: "shot.hit", payload: { at: target, shipId: hitShip.shipId } });

        const sunkNow = isShipSunk(opponent, hitShip) && !opponent.sunkShipIds.includes(hitShip.shipId);
        if (sunkNow) {
          opponent.sunkShipIds.push(hitShip.shipId);
          events.push({ eventType: "ship.sunk", payload: { shipId: hitShip.shipId, ownerPlayerId: opponent.playerId } });
        }
      } else {
        events.push({ eventType: "shot.miss", payload: { at: target } });
      }

      const allSunk = opponent.sunkShipIds.length === state.config.ships.length;
      if (allSunk) {
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
    const me = state.players.find((player) => player.playerId === input.playerId);
    const opponent = state.players.find((player) => player.playerId !== input.playerId);

    if (!me || !opponent) {
      return { visibleState: state };
    }

    const opponentSunkShips = opponent.ships
      .filter((ship) => opponent.sunkShipIds.includes(ship.shipId))
      .map((ship) => ({ shipId: ship.shipId, cells: ship.cells }));

    // Game over means no hidden information is left: reveal the fleet so the
    // final board answers "where WERE they?".
    const revealedShips =
      state.phase === "terminal"
        ? opponent.ships.map((ship) => ({ shipId: ship.shipId, cells: ship.cells }))
        : [];

    return {
      visibleState: {
        phase: state.phase,
        currentPlayerId: state.currentPlayerId,
        winnerPlayerId: state.winnerPlayerId,
        ownBoard: {
          rows: state.config.rows,
          cols: state.config.cols,
          ships: me.ships,
          hitsTaken: me.hitsTaken,
          sunkShipIds: me.sunkShipIds,
          shotsFired: me.shotsFired
        },
        opponentBoard: {
          rows: state.config.rows,
          cols: state.config.cols,
          shotsFired: me.shotsFired,
          knownHits: me.shotsFired.filter((shot) => getShipByCell(opponent, shot) !== null),
          sunkShips: opponentSunkShips,
          revealedShips
        }
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
