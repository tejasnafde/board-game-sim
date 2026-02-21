import { lobbyPanelMarkup } from "../../templates/lobby";
import type { LabyrinthView } from "./types";

function renderBoardMarkup(view: LabyrinthView): string {
  const board = view.board ?? [];
  const reachable = new Set((view.myState?.reachableCells ?? []).map((cell) => `${cell.row},${cell.col}`));
  const players = view.players ?? [];

  const cells: string[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const tile = board[row]?.[col];
      const openings = tile?.openings ?? { N: false, E: false, S: false, W: false };
      const playerTokens = players
        .filter((player) => player.position.row === row && player.position.col === col)
        .map((player) => player.playerId)
        .join(",");

      const classes = ["labyrinth-cell"];
      if (reachable.has(`${row},${col}`)) {
        classes.push("reachable");
      }

      cells.push(
        `<button class="${classes.join(" ")}" data-lab-cell="1" data-r="${row}" data-c="${col}" title="${row},${col} obj=${tile?.objectiveId ?? "-"} players=${playerTokens || "-"}">
          <span class="tile-openings">${openings.N ? "N" : ""}${openings.E ? "E" : ""}${openings.S ? "S" : ""}${openings.W ? "W" : ""}</span>
          <span class="tile-obj">${tile?.objectiveId ?? ""}</span>
          <span class="tile-players">${playerTokens}</span>
        </button>`
      );
    }
  }
  return `<div class="labyrinth-grid">${cells.join("")}</div>`;
}

export function renderLabyrinthLobby(sessionId: string, playerId: string): string {
  return `
    <section class="screen labyrinth-screen">
      <header class="section-head">
        <h1>Labyrinth</h1>
        <p>Join a session and navigate the shifting maze to recover objectives.</p>
      </header>
      ${lobbyPanelMarkup(sessionId, playerId, {
        title: "Maze Lobby",
        joinLabel: "Join Maze",
        hint: "Use player IDs player-1 through player-4 for the demo session."
      })}
    </section>
  `;
}

export function renderLabyrinthGameplay(
  view: LabyrinthView,
  playerId: string,
  logs: string[],
  stateDump: string
): string {
  const insertionIndexes = view.config?.insertionIndexes ?? [1, 3, 5];
  const myObjectives = (view.myState?.remainingObjectives ?? []).map((objective) => objective.id).join(", ") || "none";
  const isMyTurn = view.currentPlayerId === playerId;
  const turnHint =
    view.turnStage === "insert"
      ? "Insert the spare tile from a highlighted edge slot."
      : "Move to any reachable highlighted cell.";

  const insertionButtons = insertionIndexes
    .map(
      (index) => `
        <button class="btn btn-secondary labyrinth-insert-btn" data-edge="top" data-index="${index}">Top ${index}</button>
        <button class="btn btn-secondary labyrinth-insert-btn" data-edge="bottom" data-index="${index}">Bottom ${index}</button>
        <button class="btn btn-secondary labyrinth-insert-btn" data-edge="left" data-index="${index}">Left ${index}</button>
        <button class="btn btn-secondary labyrinth-insert-btn" data-edge="right" data-index="${index}">Right ${index}</button>
      `
    )
    .join("");

  return `
    <section class="screen labyrinth-screen">
      <header class="section-head">
        <h1>Labyrinth</h1>
        <p>
          Phase: <strong>${view.phase ?? "play"}</strong> · Stage: <strong>${view.turnStage ?? "insert"}</strong>
          · Turn: <strong>${view.currentPlayerId ?? "-"}</strong>
          ${view.winnerPlayerId ? `· Winner: <strong>${view.winnerPlayerId}</strong>` : ""}
        </p>
        <p>${isMyTurn ? turnHint : "Waiting for active player's turn."}</p>
      </header>
      <div class="gameplay-screen">
        <div class="card panel board-panel">
          <h3>Maze Board</h3>
          <div class="row-actions labyrinth-insert-controls" id="labyrinth-insert-controls">${insertionButtons}</div>
          <div id="labyrinth-board">${renderBoardMarkup(view)}</div>
        </div>
        <aside class="side-stack">
          <div class="card panel">
            <h3>Your Objectives</h3>
            <p>${myObjectives}</p>
          </div>
          <div class="card panel debug-panel">
            <h3>Debug Log</h3>
            <pre>${logs.join("\n") || "no_logs_yet"}</pre>
          </div>
          <div class="card panel log-panel">
            <h3>Session State</h3>
            <pre>${stateDump}</pre>
          </div>
        </aside>
      </div>
    </section>
  `;
}
