import type { Coord, Direction, Insertion, LabyrinthConfig, Tile } from "./types";

type BoardSize = Pick<LabyrinthConfig, "rows" | "cols">;

export const DIRS: Direction[] = ["N", "E", "S", "W"];
export const OPPOSITE: Record<Direction, Direction> = { N: "S", S: "N", E: "W", W: "E" };

export function coordKey(c: Coord): string {
  return `${c.row}:${c.col}`;
}

export function inBounds(c: Coord, config: BoardSize): boolean {
  return c.row >= 0 && c.row < config.rows && c.col >= 0 && c.col < config.cols;
}

export function nextCoord(c: Coord, dir: Direction): Coord {
  if (dir === "N") return { row: c.row - 1, col: c.col };
  if (dir === "S") return { row: c.row + 1, col: c.col };
  if (dir === "E") return { row: c.row, col: c.col + 1 };
  return { row: c.row, col: c.col - 1 };
}

/** Pure row/col shift: returns the new board and the ejected tile as spare. */
export function shiftBoard(
  board: Tile[][],
  spare: Tile,
  insertion: Insertion,
  config: BoardSize
): { board: Tile[][]; spare: Tile } {
  const next = board.map((row) => [...row]);
  let ejected: Tile;

  if (insertion.edge === "top") {
    ejected = next[config.rows - 1]![insertion.index]!;
    for (let row = config.rows - 1; row > 0; row -= 1) {
      next[row]![insertion.index] = next[row - 1]![insertion.index]!;
    }
    next[0]![insertion.index] = spare;
  } else if (insertion.edge === "bottom") {
    ejected = next[0]![insertion.index]!;
    for (let row = 0; row < config.rows - 1; row += 1) {
      next[row]![insertion.index] = next[row + 1]![insertion.index]!;
    }
    next[config.rows - 1]![insertion.index] = spare;
  } else if (insertion.edge === "left") {
    ejected = next[insertion.index]![config.cols - 1]!;
    for (let col = config.cols - 1; col > 0; col -= 1) {
      next[insertion.index]![col] = next[insertion.index]![col - 1]!;
    }
    next[insertion.index]![0] = spare;
  } else {
    ejected = next[insertion.index]![0]!;
    for (let col = 0; col < config.cols - 1; col += 1) {
      next[insertion.index]![col] = next[insertion.index]![col + 1]!;
    }
    next[insertion.index]![config.cols - 1] = spare;
  }

  return { board: next, spare: ejected };
}

/** Where a pawn/objective on `position` ends up after `insertion` (wraps). */
export function shiftPosition(position: Coord, insertion: Insertion, config: BoardSize): Coord {
  if (insertion.edge === "top" && position.col === insertion.index) {
    return { row: (position.row + 1) % config.rows, col: position.col };
  }
  if (insertion.edge === "bottom" && position.col === insertion.index) {
    return { row: (position.row - 1 + config.rows) % config.rows, col: position.col };
  }
  if (insertion.edge === "left" && position.row === insertion.index) {
    return { row: position.row, col: (position.col + 1) % config.cols };
  }
  if (insertion.edge === "right" && position.row === insertion.index) {
    return { row: position.row, col: (position.col - 1 + config.cols) % config.cols };
  }
  return position;
}

export function findReachable(board: Tile[][], config: BoardSize, from: Coord): Set<string> {
  const visited = new Set<string>([coordKey(from)]);
  const queue: Coord[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const tile = board[current.row]?.[current.col];
    if (!tile) continue;
    for (const dir of DIRS) {
      if (!tile.openings[dir]) continue;
      const dest = nextCoord(current, dir);
      if (!inBounds(dest, config)) continue;
      if (!board[dest.row]?.[dest.col]?.openings[OPPOSITE[dir]]) continue;
      const key = coordKey(dest);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(dest);
    }
  }

  return visited;
}

/** BFS shortest path from → to (inclusive), or null when unreachable. */
export function findPath(board: Tile[][], config: BoardSize, from: Coord, to: Coord): Coord[] | null {
  const parent = new Map<string, Coord | null>([[coordKey(from), null]]);
  const queue: Coord[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.row === to.row && current.col === to.col) {
      const path: Coord[] = [];
      for (let step: Coord | null = current; step; step = parent.get(coordKey(step)) ?? null) {
        path.unshift(step);
      }
      return path;
    }
    const tile = board[current.row]?.[current.col];
    if (!tile) continue;
    for (const dir of DIRS) {
      if (!tile.openings[dir]) continue;
      const dest = nextCoord(current, dir);
      if (!inBounds(dest, config)) continue;
      if (!board[dest.row]?.[dest.col]?.openings[OPPOSITE[dir]]) continue;
      const key = coordKey(dest);
      if (parent.has(key)) continue;
      parent.set(key, current);
      queue.push(dest);
    }
  }
  return null;
}

/** Board cell of the tile carrying `objectiveId`, or null while it is the spare. */
export function findObjectiveTile(board: Tile[][], objectiveId: string): Coord | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      if (board[row]![col]!.objectiveId === objectiveId) return { row, col };
    }
  }
  return null;
}
