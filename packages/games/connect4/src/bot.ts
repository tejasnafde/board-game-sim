import type { GameBot } from "@board-game-sim/shared";
import type { Connect4Config, Connect4State } from "./rules/types";
import { dropRow, findWin } from "./rules/connect4-module";

/**
 * Alpha-beta minimax Connect Four AI. Deterministic (no rng): same position →
 * same move, which keeps self-play tests and replays stable.
 * ponytail: depth 7 ≈ instant in JS and beats casual humans; a transposition
 * table / iterative deepening is the upgrade path if it ever feels weak.
 */
const DEPTH = 6;
const WIN_SCORE = 1_000_000;

type Grid = (string | null)[][];

function orderedCols(cols: number): number[] {
  // Center-first: best pruning and strongest default play.
  const center = Math.floor(cols / 2);
  const order = [center];
  for (let offset = 1; offset <= center; offset += 1) {
    if (center - offset >= 0) order.push(center - offset);
    if (center + offset < cols) order.push(center + offset);
  }
  return order;
}

function scoreWindow(window: (string | null)[], me: string, opponent: string): number {
  let mine = 0;
  let theirs = 0;
  for (const cell of window) {
    if (cell === me) mine += 1;
    else if (cell === opponent) theirs += 1;
  }
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 3) return 100;
  if (mine === 2) return 10;
  if (theirs === 3) return -120; // blocking matters slightly more than building
  if (theirs === 2) return -10;
  return 0;
}

function evaluate(grid: Grid, config: Connect4Config, me: string, opponent: string): number {
  let score = 0;
  const { rows, cols, connect } = config;

  const center = Math.floor(cols / 2);
  for (let row = 0; row < rows; row += 1) {
    if (grid[row]![center] === me) score += 6;
    else if (grid[row]![center] === opponent) score -= 6;
  }

  const window: (string | null)[] = new Array(connect);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (col + connect <= cols) {
        for (let i = 0; i < connect; i += 1) window[i] = grid[row]![col + i]!;
        score += scoreWindow(window, me, opponent);
      }
      if (row + connect <= rows) {
        for (let i = 0; i < connect; i += 1) window[i] = grid[row + i]![col]!;
        score += scoreWindow(window, me, opponent);
      }
      if (row + connect <= rows && col + connect <= cols) {
        for (let i = 0; i < connect; i += 1) window[i] = grid[row + i]![col + i]!;
        score += scoreWindow(window, me, opponent);
      }
      if (row + connect <= rows && col - connect + 1 >= 0) {
        for (let i = 0; i < connect; i += 1) window[i] = grid[row + i]![col - i]!;
        score += scoreWindow(window, me, opponent);
      }
    }
  }
  return score;
}

/**
 * Value of the position for `toMove` (about to play), searching `depth` plies.
 * Negamax convention: parent negates the child's value.
 */
function negamax(
  grid: Grid,
  config: Connect4Config,
  cols: number[],
  toMove: string,
  other: string,
  depth: number,
  alpha: number,
  beta: number
): number {
  let best = -Infinity;
  let anyMove = false;

  for (const col of cols) {
    const row = dropRow(grid, col);
    if (row === -1) continue;
    anyMove = true;

    grid[row]![col] = toMove;
    let value: number;
    if (findWin(grid, config, { row, col })) {
      // Prefer faster wins / slower losses so the bot finishes games off.
      value = WIN_SCORE + depth;
    } else if (depth === 0) {
      value = evaluate(grid, config, toMove, other);
    } else {
      value = -negamax(grid, config, cols, other, toMove, depth - 1, -beta, -alpha);
    }
    grid[row]![col] = null;

    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  return anyMove ? best : 0; // board full = draw
}

export const connect4Bot: GameBot = ({ view, playerId }) => {
  const state = view as unknown as Connect4State;
  if (state.phase !== "play" || state.currentPlayerId !== playerId) return null;

  const opponent = state.players.find((p) => p !== playerId) ?? "";
  const grid = state.grid.map((row) => [...row]);
  const cols = orderedCols(state.config.cols);

  let bestCol = -1;
  let bestValue = -Infinity;
  let alpha = -Infinity;
  for (const col of cols) {
    const row = dropRow(grid, col);
    if (row === -1) continue;

    grid[row]![col] = playerId;
    const value = findWin(grid, state.config, { row, col })
      ? WIN_SCORE + DEPTH
      : -negamax(grid, state.config, cols, opponent, playerId, DEPTH - 1, -Infinity, -alpha);
    grid[row]![col] = null;

    if (value > bestValue) {
      bestValue = value;
      bestCol = col;
    }
    if (value > alpha) alpha = value;
  }

  if (bestCol === -1) return null;
  return { actionType: "drop", payload: { col: bestCol } };
};
