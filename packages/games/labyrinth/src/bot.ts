import type { GameBot } from "@board-game-sim/shared";
import type { Coord, Edge, Insertion, LabyrinthConfig, RotationDeg, Tile } from "./rules/types";
import { coordKey, findObjectiveTile, findReachable, rotateTile, shiftBoard, shiftPosition } from "./rules/board";

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
    remainingObjectives: { id: string }[];
    reachableCells: Coord[];
  };
};

const EDGES: Edge[] = ["top", "bottom", "left", "right"];
const ROTATIONS: RotationDeg[] = [0, 90, 180, 270];
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

  const targetId = v.myState.remainingObjectives[0]?.id ?? null;

  if (v.turnStage === "insert") {
    const best: Array<{ insertion: Insertion; rotationDeg: RotationDeg }> = [];
    let bestScore = -Infinity;

    for (const rotationDeg of ROTATIONS) {
      const spareTile = rotateTile(v.spareTile, rotationDeg);
      for (const insertion of legalInsertions(v.config, v.lastInsertion)) {
        const shifted = shiftBoard(v.board, spareTile, insertion, v.config);
        const myPos = shiftPosition(v.myState.position, insertion, v.config);
        const targetPos = targetId
          ? findObjectiveTile(shifted.board, targetId)
          : shiftPosition(v.myState.home, insertion, v.config);
        if (!targetPos) continue;
        const reachable = findReachable(shifted.board, v.config, myPos);
        const score = reachable.has(coordKey(targetPos))
          ? 1000 - manhattan(myPos, targetPos)
          : -closestDistance(reachable, targetPos);

        if (score > bestScore) {
          bestScore = score;
          best.length = 0;
          best.push({ insertion, rotationDeg });
        } else if (score === bestScore) {
          best.push({ insertion, rotationDeg });
        }
      }
    }

    if (best.length === 0) return null;
    const currentRotation = best.filter((candidate) => candidate.rotationDeg === v.spareTile.rotationDeg);
    const candidates = currentRotation.length > 0 ? currentRotation : best;
    const selected = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]!;
    if (selected.rotationDeg !== v.spareTile.rotationDeg) {
      return { actionType: "rotate_spare", payload: { rotationDeg: selected.rotationDeg } };
    }
    return { actionType: "insert_tile", payload: selected.insertion };
  }

  // move stage: the view's reachableCells reflect the post-insert board.
  const target = (targetId ? findObjectiveTile(v.board, targetId) : null) ?? v.myState.home;
  const reachable = v.myState.reachableCells;
  let bestCell = reachable[0];
  for (const cell of reachable) {
    if (bestCell && manhattan(cell, target) < manhattan(bestCell, target)) bestCell = cell;
  }
  if (!bestCell) return null;
  return { actionType: "move_pawn", payload: bestCell };
};
