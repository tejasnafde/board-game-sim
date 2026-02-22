import type { Coord } from "@board-game-sim/battleship";
import type { GameRenderer } from "./renderer-registry";

type BoardView = {
  rows: number;
  cols: number;
  ships?: Array<{ shipId: string; cells: Coord[] }>;
  hitsTaken?: Coord[];
  shotsFired?: Coord[];
  knownHits?: Coord[];
  sunkShips?: Array<{ shipId: string; cells: Coord[] }>;
};

type ClientView = {
  phase?: string;
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  ownBoard?: BoardView;
  opponentBoard?: BoardView;
};

function key(c: Coord): string {
  return `${c.row}:${c.col}`;
}

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function boardLabelsRow(cols: number): string {
  const labels = Array.from({ length: cols }, (_, i) =>
    `<div style="text-align:center;font-size:10px;font-weight:600;color:var(--text-muted);letter-spacing:0.04em;user-select:none;">${COL_LABELS[i] ?? i}</div>`
  ).join("");
  return `<div style="display:grid;grid-template-columns:20px repeat(${cols},1fr);gap:2px;margin-bottom:2px;">
    <div></div>${labels}
  </div>`;
}

function renderOwnBoard(board: BoardView): string {
  const shipCells = new Set((board.ships ?? []).flatMap((ship) => ship.cells.map(key)));
  const hits = new Set((board.hitsTaken ?? []).map(key));

  const rows: string[] = [];
  for (let r = 0; r < board.rows; r += 1) {
    const cells: string[] = [];
    for (let c = 0; c < board.cols; c += 1) {
      const coord = `${r}:${c}`;
      let cls = "cell water";
      if (shipCells.has(coord) && hits.has(coord)) cls = "cell taken-hit";
      else if (shipCells.has(coord)) cls = "cell ship";
      cells.push(`<button class="${cls} own-cell" data-board="own" data-r="${r}" data-c="${c}" type="button" aria-label="Own ${r},${c}"></button>`);
    }
    const rowLabel = `<div style="font-size:10px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;justify-content:center;user-select:none;">${r + 1}</div>`;
    rows.push(`<div style="display:grid;grid-template-columns:20px repeat(${board.cols},1fr);gap:2px;">${rowLabel}${cells.join("")}</div>`);
  }

  return `
    <div>
      ${boardLabelsRow(board.cols)}
      <div style="display:flex;flex-direction:column;gap:2px;">${rows.join("")}</div>
    </div>
  `;
}

function renderOpponentBoard(board: BoardView): string {
  const fired = new Set((board.shotsFired ?? []).map(key));
  const knownHits = new Set((board.knownHits ?? []).map(key));
  // Show sunk ship cells so player can see them
  const sunkCells = new Set((board.sunkShips ?? []).flatMap((ship) => ship.cells.map(key)));

  const rows: string[] = [];
  for (let r = 0; r < board.rows; r += 1) {
    const cells: string[] = [];
    for (let c = 0; c < board.cols; c += 1) {
      const coord = `${r}:${c}`;
      let cls = "cell water";
      if (fired.has(coord) && knownHits.has(coord)) cls = "cell attack-hit";
      else if (fired.has(coord)) cls = "cell attack-miss";
      const extra = !fired.has(coord) ? " opponent-cell" : "";
      cells.push(`<button class="${cls}${extra}" data-board="opponent" data-r="${r}" data-c="${c}" type="button" aria-label="Fire ${r},${c}"></button>`);
    }
    const rowLabel = `<div style="font-size:10px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;justify-content:center;user-select:none;">${r + 1}</div>`;
    rows.push(`<div style="display:grid;grid-template-columns:20px repeat(${board.cols},1fr);gap:2px;">${rowLabel}${cells.join("")}</div>`);
  }

  return `
    <div>
      ${boardLabelsRow(board.cols)}
      <div style="display:flex;flex-direction:column;gap:2px;">${rows.join("")}</div>
    </div>
  `;
}

export class GridRenderer implements GameRenderer {
  render(view: unknown): string {
    const payload = (view ?? {}) as ClientView;
    const own = payload.ownBoard ?? { rows: 10, cols: 10 };
    const opponent = payload.opponentBoard ?? { rows: 10, cols: 10 };

    // Count stats
    const ownHitsCount = (own.hitsTaken ?? []).length;
    const totalOwnCells = (own.ships ?? []).reduce((n, s) => n + s.cells.length, 0);
    const myHitsCount = (opponent.knownHits ?? []).length;
    const missCount = (opponent.shotsFired ?? []).length - myHitsCount;

    return `
      <div class="board-root">
        <div class="board-columns">
          <section class="own-panel">
            <h3>Your Board</h3>
            <div class="board-wrapper">
              ${renderOwnBoard(own)}
            </div>
            <div class="board-meta">
              <span>${ownHitsCount} hit${ownHitsCount !== 1 ? "s" : ""} taken</span>
              <span>${totalOwnCells - ownHitsCount} cells intact</span>
            </div>
          </section>
          <section class="opponent-panel">
            <h3>Opponent Board — click to fire</h3>
            <div class="board-wrapper">
              ${renderOpponentBoard(opponent)}
            </div>
            <div class="board-meta">
              <span style="color:#86efac">${myHitsCount} hit${myHitsCount !== 1 ? "s" : ""}</span>
              <span>${missCount} miss${missCount !== 1 ? "es" : ""}</span>
              <span>${(opponent.shotsFired ?? []).length} shots fired</span>
            </div>
          </section>
        </div>
      </div>
    `;
  }
}
