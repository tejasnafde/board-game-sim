import type { GameBot } from "@board-game-sim/shared";
import type { BattleshipShipSpec, Coord, ShipPlacement } from "./rules/types";

// Shapes the bot reads from getPlayerView / definition.json.
type BattleshipView = {
  phase: "setup" | "play" | "terminal";
  currentPlayerId: string;
  ownBoard: { rows: number; cols: number; ships: ShipPlacement[] };
  opponentBoard: { shotsFired: Coord[]; knownHits: Coord[]; sunkShips: { shipId: string; cells: Coord[] }[] };
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

const AROUND: Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 }
];

/**
 * Classic hunt/target: parity search until a hit, then finish the ship —
 * extending along the line once two hits align.
 */
function pickTarget(view: BattleshipView, rng: () => number): Coord | null {
  const { rows, cols } = view.ownBoard;
  const tried = new Set(view.opponentBoard.shotsFired.map(coordKey));
  const sunkCells = new Set(view.opponentBoard.sunkShips.flatMap((s) => s.cells.map(coordKey)));
  const openHits = view.opponentBoard.knownHits.filter((h) => !sunkCells.has(coordKey(h)));
  const inBounds = (c: Coord): boolean => c.row >= 0 && c.row < rows && c.col >= 0 && c.col < cols;
  const fresh = (c: Coord): boolean => inBounds(c) && !tried.has(coordKey(c));

  // Target mode: two aligned open hits → shoot past either end first.
  const openKeys = new Set(openHits.map(coordKey));
  for (const hit of openHits) {
    for (const d of AROUND) {
      const next = { row: hit.row + d.row, col: hit.col + d.col };
      if (!openKeys.has(coordKey(next))) continue;
      // walk to the line's end in each direction, fire on the first fresh cell
      for (const sign of [1, -1]) {
        let cell = { ...hit };
        while (openKeys.has(coordKey(cell))) {
          cell = { row: cell.row + d.row * sign, col: cell.col + d.col * sign };
        }
        if (fresh(cell)) return cell;
      }
    }
  }

  // Single open hit → any fresh neighbor.
  for (const hit of openHits) {
    const options = AROUND.map((d) => ({ row: hit.row + d.row, col: hit.col + d.col })).filter(fresh);
    if (options.length > 0) return options[Math.floor(rng() * options.length)]!;
  }

  // Hunt mode: parity grid (smallest ship is 2 long), random among fresh cells.
  const parity: Coord[] = [];
  const any: Coord[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = { row, col };
      if (!fresh(cell)) continue;
      any.push(cell);
      if ((row + col) % 2 === 0) parity.push(cell);
    }
  }
  const pool = parity.length > 0 ? parity : any;
  return pool[Math.floor(rng() * pool.length)] ?? null;
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
    const target = pickTarget(v, rng);
    if (!target) return null;
    return { actionType: "fire", payload: target };
  }

  return null;
};
