import { humanizeError, lobbyPanelMarkup, terminalBannerMarkup } from "../../templates/lobby";
import { icon } from "../../icons";
import type { Connect4View } from "./types";

const DISC_CLASSES = ["c4-p1", "c4-p2"];

export function renderConnect4Lobby(sessionId: string, playerId: string, error?: string | null): string {
  return `
    <section class="screen connect4-screen">
      <div class="section-head">
        <h1><span class="c4-disc-mini c4-p1" style="width:18px;height:18px;"></span> Connect Four</h1>
        <p>Drop discs, connect four in a row - down, across, or diagonally.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
        title: "Arcade Lobby",
        joinLabel: "Join Game",
        error,
        vsBot: true
      })}
    </section>
  `;
}

export function renderConnect4Gameplay(
  view: Connect4View,
  mySeat: string,
  status: { seatNames?: Record<string, string>; lastError?: string | null } = {}
): string {
  const players = view.players ?? [];
  const grid = view.grid ?? [];
  const cols = view.config?.cols ?? 7;
  const isTerminal = view.phase === "terminal";
  const isMyTurn = !isTerminal && view.currentPlayerId === mySeat;
  const discClassOf = (seat: string | null): string =>
    seat === null ? "" : DISC_CLASSES[players.indexOf(seat)] ?? "c4-p1";
  const nameOf = (id: string | null | undefined): string =>
    id ? status.seatNames?.[id] ?? id : "";
  const winning = new Set((view.winningCells ?? []).map((c) => `${c.row},${c.col}`));
  const last = view.lastDrop;


  const heading = view.winnerPlayerId
    ? view.winnerPlayerId === mySeat
      ? "You win!"
      : `${nameOf(view.winnerPlayerId)} wins!`
    : "It's a draw!";
  const currentName = nameOf(view.currentPlayerId);
  const statusText = isMyTurn
    ? "Your turn - click a column to drop your disc"
    : currentName.startsWith("Computer")
      ? `${icon("robot", 14)} <strong>${currentName}</strong> is thinking<span class="thinking-dots"></span>`
      : `${icon("hourglass", 13)} Waiting for <strong>${currentName || "opponent"}</strong>`;
  const seatBadges = players
    .map((seat, i) => {
      const isCurrent = seat === view.currentPlayerId;
      return `<span class="c4-seat ${isCurrent ? "current" : ""}">
        <span class="c4-disc-mini ${DISC_CLASSES[i] ?? "c4-p1"}"></span>${nameOf(seat)}${seat === mySeat ? " (you)" : ""}
      </span>`;
    })
    .join("");

  const dropButtons = Array.from({ length: cols }, (_, col) => {
    const colFull = grid[0]?.[col] !== null;
    const disabled = !isMyTurn || colFull ? "disabled" : "";
    return `<button class="c4-drop-btn" data-col="${col}" ${disabled} aria-label="Drop in column ${col + 1}">▼</button>`;
  }).join("");

  return `
    <section class="screen connect4-screen">
      <div class="section-head">
        <h1><span class="c4-disc-mini c4-p1" style="width:18px;height:18px;"></span> Connect Four</h1>
        ${isTerminal
          ? terminalBannerMarkup(heading, "", !!view.winnerPlayerId)
          : `<div class="status-banner ${isMyTurn ? "your-turn" : "their-turn"}"><span>${statusText}</span></div>`}
        ${status.lastError ? `<div class="error-text" role="alert">${humanizeError(status.lastError)}</div>` : ""}
      </div>
      <div class="card board-panel" style="max-width:560px;margin:0 auto;">
        <div class="c4-seats">${seatBadges}</div>
        <div class="c4-drop-row" id="connect4-drop-row" style="grid-template-columns:repeat(${cols},1fr)">${dropButtons}</div>
        <div class="c4-board" id="connect4-board">${boardMarkup(grid, cols, discClassOf, winning, last)}</div>
      </div>
    </section>
  `;
}

function boardMarkup(
  grid: (string | null)[][],
  cols: number,
  discClassOf: (seat: string | null) => string,
  winning: Set<string>,
  last: { row: number; col: number } | null | undefined
): string {
  const rows = grid
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const classes = ["c4-cell"];
          const disc = discClassOf(cell);
          if (winning.has(`${r},${c}`)) classes.push("winning");
          const isLast = last && last.row === r && last.col === c;
          return `<div class="${classes.join(" ")}" data-col="${c}">
            ${cell !== null ? `<div class="c4-disc ${disc} ${isLast ? "last-drop" : ""}"></div>` : ""}
          </div>`;
        })
        .join("");
      return `<div class="c4-row" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`;
    })
    .join("");
  return rows;
}
