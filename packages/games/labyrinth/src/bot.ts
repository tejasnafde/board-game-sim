import type { GameBot } from "@board-game-sim/shared";
import type { Coord, Edge, Insertion, LabyrinthConfig, PlayerObjective, Tile } from "./rules/types";
import { coordKey, findReachable, shiftBoard, shiftPosition } from "./rules/board";

// Shapes the bot reads from getPlayerView.
type LabyrinthView = {
  phase: "play" | "terminal";
  turnStage: "insert" | "move";
  currentPlayerId: string;
  config: LabyrinthConfig;
  board: Tile[][];
  spareTile: Tile;
  lastInsertion: Insertion | null;
  myState: {
    position: Coord;
    home: Coord;
    remainingObjectives: PlayerObjective[];
    reachableCells: Coord[];
  };
};

const EDGES: Edge[] = ["top", "bottom", "left", "right"];
const OPPOSITE_EDGE: Record<Edge, Edge> = { top: "bottom", bottom: "top", left: "right", right: "left" };

function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function legalInsertions(config: LabyrinthConfig, last: Insertion | null): Insertion[] {
  const slots: Insertion[] = [];
  for (const edge of EDGES) {
    for (const index of config.insertionIndexes) {
      const isReverse = !!last && OPPOSITE_EDGE[last.edge] === edge && last.index === index;
      if (!isReverse) slots.push({ edge, index });
    }
  }
  return slots;
}

function closestDistance(reachable: Set<string>, target: Coord): number {
  let best = Infinity;
  for (const key of reachable) {
    const [row, col] = key.split(":").map(Number);
    best = Math.min(best, manhattan({ row: row!, col: col! }, target));
  }
  return best;
}

/**
 * Plays by simulating every legal insertion on the (fully visible) board and
 * picking the one that makes its current objective — or home, when done —
 * actually reachable, falling back to the insertion that gets closest by real
 * paths. Other players' objectives are hidden, so no blocking play; this is a
 * race, which matches the game's feel.
 */
export const labyrinthBot: GameBot = ({ view, playerId, rng }) => {
  const v = view as unknown as LabyrinthView;
  if (v.phase !== "play" || v.currentPlayerId !== playerId) return null;

  const target = v.myState.remainingObjectives[0]?.position ?? v.myState.home;

  if (v.turnStage === "insert") {
    let best: Insertion | null = null;
    let bestScore = -Infinity;

    for (const slot of legalInsertions(v.config, v.lastInsertion)) {
      const shifted = shiftBoard(v.board, v.spareTile, slot, v.config);
      const myPos = shiftPosition(v.myState.position, slot, v.config);
      const targetPos = shiftPosition(target, slot, v.config);
      const reachable = findReachable(shifted.board, v.config, myPos);

      // rng jitter breaks ties AND deterministic bot-vs-bot board cycles
      // (self-play livelocked without it); small enough to never outweigh
      // a real reachability difference.
      const score = (reachable.has(coordKey(targetPos))
        ? 1000 - manhattan(myPos, targetPos) // reachable: prefer shorter trips
        : -closestDistance(reachable, targetPos)) + rng() * 0.9;

      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    }

    if (!best) return null;
    return { actionType: "insert_tile", payload: best };
  }

  // move stage: the view's reachableCells reflect the post-insert board.
  const reachable = v.myState.reachableCells;
  let bestCell = reachable[0];
  for (const cell of reachable) {
    if (bestCell && manhattan(cell, target) < manhattan(bestCell, target)) bestCell = cell;
  }
  if (!bestCell) return null;
  return { actionType: "move_pawn", payload: bestCell };
};
