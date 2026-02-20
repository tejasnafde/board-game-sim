import type { ShipPlacement } from "@board-game-sim/battleship";

type BattleshipDefinition = {
  board: {
    rows: number;
    cols: number;
  };
  ships: Array<{
    id: string;
    size: number;
  }>;
};

export function createDefaultPlacementsFromDefinition(definition: BattleshipDefinition): ShipPlacement[] {
  return definition.ships.map((ship, idx) => ({
    shipId: ship.id,
    cells: Array.from({ length: ship.size }).map((_, offset) => ({
      row: idx,
      col: offset
    }))
  }));
}
