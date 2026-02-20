import type { Coord } from "@board-game-sim/battleship";
import type { GameRenderer } from "./renderer-registry";

type BoardView = {
  rows: number;
  cols: number;
  ships?: Array<{ shipId: string; cells: Coord[] }>;
  hitsTaken?: Coord[];
  shotsFired?: Coord[];
  knownHits?: Coord[];
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

function renderOwnBoard(board: BoardView): string {
  const shipCells = new Set((board.ships ?? []).flatMap((ship) => ship.cells.map(key)));
  const hits = new Set((board.hitsTaken ?? []).map(key));

  const cells: string[] = [];
  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      const coord = `${r}:${c}`;
      let className = "cell water";
      if (shipCells.has(coord)) className = "cell ship";
      if (hits.has(coord)) className = "cell taken-hit";
      cells.push(`<div class="${className}" data-r="${r}" data-c="${c}"></div>`);
    }
  }

  return `<div class="board-grid">${cells.join("")}</div>`;
}

function renderOpponentBoard(board: BoardView): string {
  const fired = new Set((board.shotsFired ?? []).map(key));
  const knownHits = new Set((board.knownHits ?? []).map(key));

  const cells: string[] = [];
  for (let r = 0; r < board.rows; r += 1) {
    for (let c = 0; c < board.cols; c += 1) {
      const coord = `${r}:${c}`;
      let className = "cell water";
      if (fired.has(coord) && knownHits.has(coord)) className = "cell attack-hit";
      else if (fired.has(coord)) className = "cell attack-miss";
      cells.push(`<div class="${className}" data-r="${r}" data-c="${c}"></div>`);
    }
  }

  return `<div class="board-grid">${cells.join("")}</div>`;
}

export class GridRenderer implements GameRenderer {
  render(view: unknown): string {
    const payload = (view ?? {}) as ClientView;
    const phase = payload.phase ?? "unknown";
    const current = payload.currentPlayerId ?? "-";
    const winner = payload.winnerPlayerId ?? "-";
    const own = payload.ownBoard ?? { rows: 10, cols: 10 };
    const opponent = payload.opponentBoard ?? { rows: 10, cols: 10 };

    return `
      <div class="board-root" data-phase="${phase}">
        <div class="board-meta">phase=${phase} current=${current} winner=${winner}</div>
        <div class="board-columns">
          <section>
            <h3>Your Board</h3>
            ${renderOwnBoard(own)}
          </section>
          <section>
            <h3>Opponent Board</h3>
            ${renderOpponentBoard(opponent)}
          </section>
        </div>
      </div>
    `;
  }
}
