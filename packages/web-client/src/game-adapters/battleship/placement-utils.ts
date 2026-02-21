import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { createDefaultPlacementsFromDefinition } from "../../battleship-template";
import type { BattleshipDefinition, Orientation, PlacementDraft, ShipSpec } from "./types";

export function buildCellsFromAnchor(anchor: PlacementDraft, size: number): Coord[] {
  switch (anchor.rotationDeg) {
    case 0:
      return Array.from({ length: size }, (_, i) => ({ row: anchor.row, col: anchor.col + i }));
    case 90:
      return Array.from({ length: size }, (_, i) => ({ row: anchor.row + i, col: anchor.col }));
    case 180:
      return Array.from({ length: size }, (_, i) => ({ row: anchor.row, col: anchor.col - i }));
    case 270:
      return Array.from({ length: size }, (_, i) => ({ row: anchor.row - i, col: anchor.col }));
    default:
      return Array.from({ length: size }, (_, i) => ({ row: anchor.row, col: anchor.col + i }));
  }
}

export function isInBounds(cells: Coord[], definition: BattleshipDefinition): boolean {
  return cells.every(
    (cell) =>
      cell.row >= 0 &&
      cell.row < definition.board.rows &&
      cell.col >= 0 &&
      cell.col < definition.board.cols
  );
}

export function placementsToDraftMap(placements: ShipPlacement[]): Record<string, PlacementDraft> {
  const result: Record<string, PlacementDraft> = {};
  for (const placement of placements) {
    const first = placement.cells[0];
    const second = placement.cells[1] ?? first;
    const orientation: Orientation = first.row === second.row ? "horizontal" : "vertical";
    result[placement.shipId] = {
      row: first.row,
      col: first.col,
      rotationDeg: orientation === "horizontal" ? 0 : 90
    };
  }
  return result;
}

export function rotateClockwise(current: PlacementDraft["rotationDeg"]): PlacementDraft["rotationDeg"] {
  return ((current + 90) % 360) as PlacementDraft["rotationDeg"];
}

export function clampDraftToBoard(
  draft: PlacementDraft,
  shipSize: number,
  definition: BattleshipDefinition
): PlacementDraft {
  const { rows, cols } = definition.board;
  let minRow: number, maxRow: number, minCol: number, maxCol: number;
  switch (draft.rotationDeg) {
    case 0:
      minRow = 0;
      maxRow = rows - 1;
      minCol = 0;
      maxCol = cols - shipSize;
      break;
    case 90:
      minRow = 0;
      maxRow = rows - shipSize;
      minCol = 0;
      maxCol = cols - 1;
      break;
    case 180:
      minRow = 0;
      maxRow = rows - 1;
      minCol = shipSize - 1;
      maxCol = cols - 1;
      break;
    case 270:
      minRow = shipSize - 1;
      maxRow = rows - 1;
      minCol = 0;
      maxCol = cols - 1;
      break;
    default:
      minRow = 0;
      maxRow = rows - 1;
      minCol = 0;
      maxCol = cols - shipSize;
  }
  return {
    ...draft,
    row: Math.min(Math.max(draft.row, minRow), maxRow),
    col: Math.min(Math.max(draft.col, minCol), maxCol)
  };
}

export function createRandomizedPlacements(definition: BattleshipDefinition): ShipPlacement[] {
  const shipSpecs = [...definition.ships].sort((a, b) => b.size - a.size);
  const rows = definition.board.rows;
  const cols = definition.board.cols;

  const createCoordKey = (cell: Coord): string => `${cell.row},${cell.col}`;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const occupied = new Set<string>();
    const placements: ShipPlacement[] = [];

    let valid = true;
    for (const ship of shipSpecs) {
      let placed = false;
      for (let placementAttempt = 0; placementAttempt < 200; placementAttempt += 1) {
        const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
        const maxRow = orientation === "vertical" ? rows - ship.size : rows - 1;
        const maxCol = orientation === "horizontal" ? cols - ship.size : cols - 1;
        const row = Math.floor(Math.random() * (maxRow + 1));
        const col = Math.floor(Math.random() * (maxCol + 1));
        const candidate = buildCellsFromAnchor(
          { row, col, rotationDeg: orientation === "horizontal" ? 0 : 90 },
          ship.size
        );
        if (!candidate.every((cell) => !occupied.has(createCoordKey(cell)))) {
          continue;
        }

        candidate.forEach((cell) => occupied.add(createCoordKey(cell)));
        placements.push({ shipId: ship.id, cells: candidate });
        placed = true;
        break;
      }

      if (!placed) {
        valid = false;
        break;
      }
    }

    if (valid && placements.length === shipSpecs.length) {
      return placements;
    }
  }

  return createDefaultPlacementsFromDefinition(definition);
}

export function canPlaceWithoutCollision(
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  shipId: string,
  cells: Coord[]
): boolean {
  const occupied = new Set<string>();
  for (const spec of specs) {
    if (spec.id === shipId) continue;
    const draft = draftMap[spec.id];
    if (!draft) continue;
    for (const cell of buildCellsFromAnchor(draft, spec.size)) {
      occupied.add(`${cell.row},${cell.col}`);
    }
  }

  return cells.every((cell) => !occupied.has(`${cell.row},${cell.col}`));
}

export function createPlacementsFromDrafts(
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  definition: BattleshipDefinition
): ShipPlacement[] {
  return specs.map((ship) => {
    const draft = draftMap[ship.id];
    if (!draft) {
      throw new Error(`ship_not_placed_${ship.id}`);
    }
    const cells = buildCellsFromAnchor(draft, ship.size);
    if (!isInBounds(cells, definition)) {
      throw new Error(`ship_out_of_bounds_${ship.id}`);
    }
    return {
      shipId: ship.id,
      cells
    };
  });
}
