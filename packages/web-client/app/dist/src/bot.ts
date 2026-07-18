import type { GameBot } from "@board-game-sim/shared";
import type { BattleshipShipSpec, Coord, ShipPlacement } from "./rules/types";

// Shapes the bot reads from getPlayerView / definition.json.
type BattleshipView = {
  phase: "setup" | "play" | "terminal";
  currentPlayerId: string;
  ownBoard: { rows: number; cols: number; ships: ShipPlacement[] };
  opponentBoard: { shotsFired: Coord[] };
};

type BattleshipDefinition = { ships?: BattleshipShipSpec[] };

function coordKey(c: Coord): string {
  return `${c.row}:${c.col}`;
}

function randomPlacements(
  specs: BattleshipShipSpec[],
  rows: number,
  cols: number,
  rng: () => number
): ShipPlacement[] {
  const used = new Set<string>();
  const placements: ShipPlacement[] = [];

  for (const spec of specs) {
    let placed = false;
    // ponytail: rejection sampling; 5 ships on 10x10 converges in a handful of tries
    for (let attempt = 0; attempt < 200 && !placed; attempt += 1) {
      const horizontal = rng() < 0.5;
      const row = Math.floor(rng() * (horizontal ? rows : rows - spec.size + 1));
      const col = Math.floor(rng() * (horizontal ? cols - spec.size + 1 : cols));
      const cells: Coord[] = [];
      for (let i = 0; i < spec.size; i += 1) {
        cells.push(horizontal ? { row, col: col + i } : { row: row + i, col });
      }
      if (cells.some((cell) => used.has(coordKey(cell)))) continue;
      cells.forEach((cell) => used.add(coordKey(cell)));
      placements.push({ shipId: spec.id, cells });
      placed = true;
    }
    if (!placed) throw new Error(`bot_failed_to_place_ship:${spec.id}`);
  }

  return placements;
}

export const battleshipBot: GameBot = ({ view, definition, playerId, rng }) => {
  const v = view as unknown as BattleshipView;
  const def = definition as unknown as BattleshipDefinition;

  if (v.phase === "setup") {
    if (v.ownBoard.ships.length > 0) return null; // already placed
    const placements = randomPlacements(def.ships ?? [], v.ownBoard.rows, v.ownBoard.cols, rng);
    return { actionType: "place_ships", payload: { placements } };
  }

  if (v.phase === "play" && v.currentPlayerId === playerId) {
    const tried = new Set(v.opponentBoard.shotsFired.map(coordKey));
    const candidates: Coord[] = [];
    for (let row = 0; row < v.ownBoard.rows; row += 1) {
      for (let col = 0; col < v.ownBoard.cols; col += 1) {
        if (!tried.has(coordKey({ row, col }))) candidates.push({ row, col });
      }
    }
    const target = candidates[Math.floor(rng() * candidates.length)];
    if (!target) return null;
    return { actionType: "fire", payload: target };
  }

  return null;
};
