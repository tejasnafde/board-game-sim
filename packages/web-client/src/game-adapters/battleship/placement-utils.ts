import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { createDefaultPlacementsFromDefinition } from "../../battleship-template";
import type { BattleshipDefinition, Orientation, PlacementDraft, ShipSpec } from "./types";

export function buildCellsFromAnchor(anchor: PlacementDraft, size: number): Coord[] {
  const orientation = anchor.rotationDeg % 180 === 0 ? "horizontal" : "vertical";
  return Array.from({ length: size }).map((_, offset) =>
    orientation === "horizontal"
      ? { row: anchor.row, col: anchor.col + offset }
      : { row: anchor.row + offset, col: anchor.col }
  );
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
  const isHorizontal = draft.rotationDeg % 180 === 0;
  const maxRow = isHorizontal ? definition.board.rows - 1 : definition.board.rows - shipSize;
  const maxCol = isHorizontal ? definition.board.cols - shipSize : definition.board.cols - 1;
  return {
    ...draft,
    row: Math.min(Math.max(draft.row, 0), Math.max(maxRow, 0)),
    col: Math.min(Math.max(draft.col, 0), Math.max(maxCol, 0))
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
