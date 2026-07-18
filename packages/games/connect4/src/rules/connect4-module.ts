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
import type { Connect4Config, Connect4State, Coord, DropPayload } from "./types";

type Connect4Definition = {
  board?: { rows?: number; cols?: number };
  connect?: number;
};

const DIRECTIONS: Coord[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 }
];

function cloneState(state: Connect4State): Connect4State {
  return JSON.parse(JSON.stringify(state)) as Connect4State;
}

function reject(state: Connect4State, reason: string): ApplyResult<Connect4State> {
  return {
    accepted: false,
    reason,
    nextState: state,
    emittedEvents: [],
    nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
    integrityHash: deterministicHash(state)
  };
}

/** Lowest empty row in a column, or -1 when the column is full. */
export function dropRow(grid: (string | null)[][], col: number): number {
  for (let row = grid.length - 1; row >= 0; row -= 1) {
    if (grid[row]![col] === null) return row;
  }
  return -1;
}

/** Cells forming a connect-N line through `at`, or null. */
export function findWin(
  grid: (string | null)[][],
  config: Connect4Config,
  at: Coord
): Coord[] | null {
  const owner = grid[at.row]?.[at.col];
  if (!owner) return null;

  for (const dir of DIRECTIONS) {
    const line: Coord[] = [at];
    for (const sign of [1, -1]) {
      for (let step = 1; step < config.connect; step += 1) {
        const row = at.row + dir.row * step * sign;
        const col = at.col + dir.col * step * sign;
        if (row < 0 || row >= config.rows || col < 0 || col >= config.cols) break;
        if (grid[row]![col] !== owner) break;
        line.push({ row, col });
      }
    }
    if (line.length >= config.connect) return line;
  }
  return null;
}

export class Connect4Module implements GameModule<Connect4State> {
  initGame(input: InitGameInput): InitResult<Connect4State> {
    const def = input.definition as unknown as Connect4Definition;
    const config: Connect4Config = {
      rows: def.board?.rows ?? 6,
      cols: def.board?.cols ?? 7,
      connect: def.connect ?? 4
    };
    const state: Connect4State = {
      phase: "play",
      config,
      grid: Array.from({ length: config.rows }, () => Array<string | null>(config.cols).fill(null)),
      players: input.players,
      currentPlayerId: input.players[0] ?? "",
      winnerPlayerId: null,
      winningCells: [],
      lastDrop: null
    };
    return {
      initialState: state,
      emittedEvents: [{ eventType: "game.initialized", payload: { players: input.players } }],
      integrityHash: deterministicHash(state)
    };
  }

  listLegalActions(state: Connect4State, playerId: string): LegalAction[] {
    if (state.phase !== "play" || state.currentPlayerId !== playerId) return [];
    return [{ actionType: "drop", description: "Drop a disc into a non-full column" }];
  }

  applyAction(input: ApplyActionInput<Connect4State>): ApplyResult<Connect4State> {
    const state = cloneState(input.state);

    if (state.phase === "terminal") return reject(state, "terminal_state");
    if (input.actorPlayerId !== state.currentPlayerId) return reject(state, "not_your_turn");
    if (input.actionType !== "drop") return reject(state, "unsupported_action");

    const col = (input.payload as DropPayload | null)?.col;
    if (typeof col !== "number" || !Number.isInteger(col) || col < 0 || col >= state.config.cols) {
      return reject(state, "column_out_of_bounds");
    }
    const row = dropRow(state.grid, col);
    if (row === -1) return reject(state, "column_full");

    state.grid[row]![col] = input.actorPlayerId;
    state.lastDrop = { row, col };
    const events = [{ eventType: "disc.dropped", payload: { row, col, playerId: input.actorPlayerId } }];

    const win = findWin(state.grid, state.config, { row, col });
    const boardFull = state.grid[0]!.every((cell) => cell !== null);

    if (win) {
      state.phase = "terminal";
      state.winnerPlayerId = input.actorPlayerId;
      state.winningCells = win;
      events.push({ eventType: "game.ended", payload: { row, col, playerId: input.actorPlayerId } });
    } else if (boardFull) {
      state.phase = "terminal";
      events.push({ eventType: "game.ended", payload: { row, col, playerId: "" } });
    } else {
      const index = state.players.indexOf(input.actorPlayerId);
      state.currentPlayerId = state.players[(index + 1) % state.players.length]!;
    }

    return {
      accepted: true,
      nextState: state,
      emittedEvents: events,
      nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
      integrityHash: deterministicHash(state)
    };
  }

  getPlayerView(input: PlayerViewInput<Connect4State>): PlayerView {
    // No hidden information in Connect Four — everyone sees everything.
    return { visibleState: cloneState(input.state) as unknown as PlayerView["visibleState"] };
  }

  isTerminal(state: Connect4State): TerminalResult | null {
    if (state.phase !== "terminal") return null;
    return {
      winnerPlayerId: state.winnerPlayerId,
      reason: state.winnerPlayerId ? "connected_four" : "board_full_draw"
    };
  }
}
