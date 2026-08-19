import type { Coord } from "@board-game-sim/battleship";
import type { GameRenderer } from "./renderer-registry";

type ShipView = { shipId: string; cells: Coord[] };

type BoardView = {
  rows: number;
  cols: number;
  ships?: ShipView[];
  hitsTaken?: Coord[];
  shotsFired?: Coord[];
  knownHits?: Coord[];
  sunkShips?: ShipView[];
  revealedShips?: ShipView[];
};

type ClientView = {
  ownBoard?: BoardView;
  opponentBoard?: BoardView;
};

export type GridRendererAssets = {
  shipUrlById?: Record<string, string>;
  hitUrl?: string;
  missUrl?: string;
};

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function key(coord: Coord): string {
  return `${coord.row}:${coord.col}`;
}

function coordinateLabel(row: number, col: number): string {
  return `${COL_LABELS[col] ?? col + 1}${row + 1}`;
}

function shipOverlay(ship: ShipView, url: string): string {
  const rows = ship.cells.map((cell) => cell.row);
  const cols = ship.cells.map((cell) => cell.col);
  const row = Math.min(...rows);
  const col = Math.min(...cols);
  const horizontal = new Set(rows).size === 1;
  const width = horizontal ? ship.cells.length : 1;
  const height = horizontal ? 1 : ship.cells.length;

  return `<div class="battle-ship-sprite ${horizontal ? "is-horizontal" : "is-vertical"}"
    style="--ship-row:${row};--ship-col:${col};--ship-width:${width};--ship-height:${height};--ship-size:${ship.cells.length}"
    aria-hidden="true">
      <img src="${url}" alt="" />
    </div>`;
}

function effectMarkup(url: string | undefined, className: string): string {
  return url ? `<img class="battle-cell-effect ${className}" src="${url}" alt="" />` : "";
}

function boardFrame(input: {
  board: BoardView;
  kind: "own" | "opponent";
  assets: GridRendererAssets;
}): string {
  const { board, kind, assets } = input;
  const fired = new Set((board.shotsFired ?? []).map(key));
  const hits = new Set((kind === "own" ? board.hitsTaken ?? [] : board.knownHits ?? []).map(key));
  const ownShipCells = new Set((board.ships ?? []).flatMap((ship) => ship.cells.map(key)));
  const sunkCells = new Set((board.sunkShips ?? []).flatMap((ship) => ship.cells.map(key)));
  const revealedCells = new Set((board.revealedShips ?? []).flatMap((ship) => ship.cells.map(key)));
  const cells: string[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const coord = `${row}:${col}`;
      const classes = ["cell", kind === "own" ? "own-cell" : "opponent-board-cell"];
      let effect = "";
      let state = "open water";

      if (kind === "own") {
        if (ownShipCells.has(coord)) {
          classes.push("ship");
          state = "your ship";
        } else {
          classes.push("water");
        }
        if (hits.has(coord)) {
          classes.push("taken-hit");
          effect = effectMarkup(assets.hitUrl, "is-hit");
          state = "your ship, hit";
        }
      } else if (sunkCells.has(coord)) {
        classes.push("attack-hit", "sunk-cell");
        effect = effectMarkup(assets.hitUrl, "is-hit");
        state = "sunk ship";
      } else if (fired.has(coord) && hits.has(coord)) {
        classes.push("attack-hit");
        effect = effectMarkup(assets.hitUrl, "is-hit");
        state = "hit";
      } else if (fired.has(coord)) {
        classes.push("attack-miss");
        effect = effectMarkup(assets.missUrl, "is-miss");
        state = "miss";
      } else if (revealedCells.has(coord)) {
        classes.push("revealed-ship");
        state = "revealed ship";
      } else {
        classes.push("water", "opponent-cell");
      }

      cells.push(`<button class="${classes.join(" ")}" data-board="${kind}" data-r="${row}" data-c="${col}" type="button" aria-label="${kind === "own" ? "Own" : "Target"} ${coordinateLabel(row, col)}, ${state}">${effect}</button>`);
    }
  }

  const visibleShips = kind === "own"
    ? board.ships ?? []
    : [...(board.revealedShips ?? []), ...(board.sunkShips ?? [])];
  const seenShips = new Set<string>();
  const ships = visibleShips
    .filter((ship) => {
      if (seenShips.has(ship.shipId)) return false;
      seenShips.add(ship.shipId);
      return true;
    })
    .map((ship) => {
      const url = assets.shipUrlById?.[ship.shipId];
      return url ? shipOverlay(ship, url) : "";
    })
    .join("");
  const columnLabels = Array.from({ length: board.cols }, (_, col) =>
    `<span>${COL_LABELS[col] ?? col + 1}</span>`
  ).join("");
  const rowLabels = Array.from({ length: board.rows }, (_, row) => `<span>${row + 1}</span>`).join("");

  return `<div class="battle-board" style="--battle-cols:${board.cols};--battle-rows:${board.rows}">
    <div class="battle-corner" aria-hidden="true"></div>
    <div class="battle-column-labels" aria-hidden="true">${columnLabels}</div>
    <div class="battle-row-labels" aria-hidden="true">${rowLabels}</div>
    <div class="battle-cell-grid">${cells.join("")}${ships}</div>
  </div>`;
}

export class GridRenderer implements GameRenderer {
  constructor(private readonly assets: GridRendererAssets = {}) {}

  render(view: unknown): string {
    const payload = (view ?? {}) as ClientView;
    const own = payload.ownBoard ?? { rows: 10, cols: 10 };
    const opponent = payload.opponentBoard ?? { rows: 10, cols: 10 };
    const ownHitsCount = (own.hitsTaken ?? []).length;
    const totalOwnCells = (own.ships ?? []).reduce((count, ship) => count + ship.cells.length, 0);
    const myHitsCount = (opponent.knownHits ?? []).length;
    const missCount = (opponent.shotsFired ?? []).length - myHitsCount;

    return `<div class="board-root">
      <div class="board-columns">
        <section class="own-panel">
          <div class="battle-board-heading">
            <h2>Your fleet</h2>
            <span class="battle-board-state"><strong>${Math.max(0, totalOwnCells - ownHitsCount)}</strong> hull cells intact</span>
          </div>
          <div class="board-wrapper">${boardFrame({ board: own, kind: "own", assets: this.assets })}</div>
          <div class="board-meta">
            <span class="num">${ownHitsCount} hit${ownHitsCount === 1 ? "" : "s"} taken</span>
            <span class="num">${Math.max(0, totalOwnCells - ownHitsCount)} intact</span>
          </div>
        </section>
        <section class="opponent-panel">
          <div class="battle-board-heading">
            <h2>Targeting grid</h2>
            <span class="battle-board-state"><strong>${myHitsCount}</strong> confirmed hit${myHitsCount === 1 ? "" : "s"}</span>
          </div>
          <div class="board-wrapper">${boardFrame({ board: opponent, kind: "opponent", assets: this.assets })}</div>
          <div class="board-meta">
            <span class="battle-stat-hit">${myHitsCount} hit${myHitsCount === 1 ? "" : "s"}</span>
            <span>${missCount} miss${missCount === 1 ? "" : "es"}</span>
            <span>${(opponent.shotsFired ?? []).length} salvos</span>
          </div>
        </section>
      </div>
    </div>`;
  }
}
