import { lobbyPanelMarkup } from "../../templates/lobby";
import type { LabyrinthView } from "./types";

type Openings = Record<"N" | "E" | "S" | "W", boolean>;

const PLAYER_COLORS = ["player-color-0", "player-color-1", "player-color-2", "player-color-3"];
const PLAYER_INITIALS = ["P1", "P2", "P3", "P4"];

/**
 * Render an SVG tile showing corridors (paths between open edges) on a dark bg.
 * Uses simple straight lines from the center to each open edge.
 */
function tileCorridorSvg(openings: Openings, objectiveId: string | null): string {
  const BG = "#0e2010";
  const PATH_COLOR = "#4ade80";
  const WALL_COLOR = "#1a3020";
  const size = 100;
  const half = size / 2;
  const corridorW = 28; // width of corridor as % of cell
  const cw = (size * corridorW) / 100;

  // Center rect (always visible if any opening)
  const hasAny = openings.N || openings.E || openings.S || openings.W;

  let paths = "";
  // Center square
  if (hasAny) {
    paths += `<rect x="${half - cw / 2}" y="${half - cw / 2}" width="${cw}" height="${cw}" fill="${PATH_COLOR}" rx="2"/>`;
  }

  // North arm
  if (openings.N) {
    paths += `<rect x="${half - cw / 2}" y="0" width="${cw}" height="${half}" fill="${PATH_COLOR}"/>`;
  }
  // South arm
  if (openings.S) {
    paths += `<rect x="${half - cw / 2}" y="${half}" width="${cw}" height="${half}" fill="${PATH_COLOR}"/>`;
  }
  // West arm
  if (openings.W) {
    paths += `<rect x="0" y="${half - cw / 2}" width="${half}" height="${cw}" fill="${PATH_COLOR}"/>`;
  }
  // East arm
  if (openings.E) {
    paths += `<rect x="${half}" y="${half - cw / 2}" width="${half}" height="${cw}" fill="${PATH_COLOR}"/>`;
  }

  // Gem marker for objective
  const gem = objectiveId
    ? `<circle cx="${size - 10}" cy="10" r="6" fill="#fbbf24" opacity="0.9"/>`
    : "";

  return `<svg class="tile-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${paths}
    ${gem}
  </svg>`;
}

function renderBoardMarkup(view: LabyrinthView, playerId: string): string {
  const board = view.board ?? [];
  const reachable = new Set(
    (view.myState?.reachableCells ?? []).map((cell) => `${cell.row},${cell.col}`)
  );
  const players = view.players ?? [];
  // Map each player to their index for color
  const playerIndexMap = new Map(players.map((p, i) => [p.playerId, i]));

  const cells: string[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const tile = board[row]?.[col];
      const openings: Openings = tile?.openings ?? { N: false, E: false, S: false, W: false };
      const objectiveId = tile?.objectiveId ?? null;

      const playersHere = players.filter(
        (p) => p.position.row === row && p.position.col === col
      );

      const isReachable = reachable.has(`${row},${col}`);
      const classes = ["labyrinth-cell"];
      if (isReachable) classes.push("reachable");

      const playerTokens = playersHere
        .map((p) => {
          const colorClass = PLAYER_COLORS[playerIndexMap.get(p.playerId) ?? 0] ?? "player-color-0";
          const label = PLAYER_INITIALS[playerIndexMap.get(p.playerId) ?? 0] ?? p.playerId.slice(0, 2).toUpperCase();
          return `<div class="player-token ${colorClass}">${label}</div>`;
        })
        .join("");

      cells.push(
        `<button class="${classes.join(" ")}" data-lab-cell="1" data-r="${row}" data-c="${col}" title="${objectiveId ? `🏆 ${objectiveId}` : ""}">
          ${tileCorridorSvg(openings, objectiveId)}
          ${playerTokens}
        </button>`
      );
    }
  }
  return `<div class="labyrinth-grid">${cells.join("")}</div>`;
}

function renderSpareTile(view: LabyrinthView): string {
  if (!view.spareTile) return "";
  const tile = view.spareTile as { openings?: Openings; objectiveId?: string | null };
  const openings = tile.openings ?? { N: false, E: false, S: false, W: false };
  return `
    <div class="spare-tile-wrap">
      <div class="spare-tile-box">${tileCorridorSvg(openings, tile.objectiveId ?? null)}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.08em;">Spare Tile</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Insert from any arrow</div>
      </div>
    </div>
  `;
}

export function renderLabyrinthLobby(sessionId: string, playerId: string): string {
  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>🌀 Labyrinth</h1>
        <p>Navigate the shifting maze. Insert the spare tile, move your pawn, collect objectives and return home to win.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Maze Lobby",
    joinLabel: "Enter Maze"
  })}
    </section>
  `;
}

export function renderLabyrinthGameplay(
  view: LabyrinthView,
  playerId: string,
  logs: string[],
  _stateDump: string
): string {
  const insertionIndexes = view.config?.insertionIndexes ?? [1, 3, 5];
  const isTerminal = view.phase === "terminal";
  const isMyTurn = view.currentPlayerId === playerId;
  const isInsertStage = view.turnStage === "insert";
  const isMoveStage = view.turnStage === "move";
  const myObjectives = view.myState?.remainingObjectives ?? [];
  const players = view.players ?? [];

  if (isTerminal) {
    return `
      <section class="screen labyrinth-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">🏆</div>
          <h2>Maze Conquered!</h2>
          <p>${view.winnerPlayerId ? `<strong>${view.winnerPlayerId}</strong> collected all objectives and returned home!` : "Someone found the way home!"}</p>
          <div class="row-actions" style="justify-content:center">
            <a class="btn btn-ghost" href="#/">← Back to Hub</a>
          </div>
        </div>
      </section>
    `;
  }

  // Board not populated yet — game hasn't started
  if (!view.board || view.board.length === 0) {
    return `
      <section class="screen labyrinth-screen">
        <div class="section-head">
          <h1>🌀 Labyrinth</h1>
        </div>
        <div class="card" style="max-width:500px;text-align:center;padding:var(--sp-8);">
          <div class="waiting-dot" style="margin:0 auto var(--sp-4);"></div>
          <h3>Waiting for the game to start…</h3>
          <p style="color:var(--text-muted);margin-top:8px;font-size:14px;">The maze will appear once all players have joined. Share the Session ID with your friends to begin.</p>
          <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:rgba(0,212,255,0.06);border-radius:var(--r-md);border:1px solid var(--border-subtle);">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:4px;">Players joined</div>
            ${view.players && view.players.length > 0
        ? view.players.map(p => `<div style="font-size:13px;color:var(--text-secondary);">${p.playerId}</div>`).join('')
        : '<div style="font-size:13px;color:var(--text-muted);">Waiting for players…</div>'
      }
          </div>
        </div>
      </section>
    `;
  }

  // Status banner
  let statusClass = "their-turn";
  let statusText = `⏳ Waiting for <strong>${view.currentPlayerId ?? "other player"}</strong>`;
  if (isMyTurn && isInsertStage) {
    statusClass = "your-turn";
    statusText = "🔀 Your turn — insert the spare tile using an arrow button";
  } else if (isMyTurn && isMoveStage) {
    statusClass = "your-turn";
    statusText = "🚶 Now move your pawn — click a highlighted cell";
  }

  // Build insertion ring around the board
  // Top row buttons: for insertionIndexes → "top, index"
  const cols = view.board?.[0]?.length ?? 7;
  const rows = view.board?.length ?? 7;

  const topBtns = Array.from({ length: cols }, (_, col) => {
    const isSlot = insertionIndexes.includes(col);
    const disabled = !isSlot || !isMyTurn || !isInsertStage ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn" data-edge="top" data-index="${col}" ${disabled} title="Insert top column ${col}">▼</button>`
      : `<div></div>`;
  }).join("");

  const bottomBtns = Array.from({ length: cols }, (_, col) => {
    const isSlot = insertionIndexes.includes(col);
    const disabled = !isSlot || !isMyTurn || !isInsertStage ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn" data-edge="bottom" data-index="${col}" ${disabled} title="Insert bottom column ${col}">▲</button>`
      : `<div></div>`;
  }).join("");

  const leftBtns = Array.from({ length: rows }, (_, row) => {
    const isSlot = insertionIndexes.includes(row);
    const disabled = !isSlot || !isMyTurn || !isInsertStage ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn" data-edge="left" data-index="${row}" ${disabled} title="Insert left row ${row}">▶</button>`
      : `<div></div>`;
  }).join("");

  const rightBtns = Array.from({ length: rows }, (_, row) => {
    const isSlot = insertionIndexes.includes(row);
    const disabled = !isSlot || !isMyTurn || !isInsertStage ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn" data-edge="right" data-index="${row}" ${disabled} title="Insert right row ${row}">◀</button>`
      : `<div></div>`;
  }).join("");

  // Players sidebar
  const playerIndexMap = new Map(players.map((p, i) => [p.playerId, i]));
  const playersList = players
    .map((p) => {
      const colorClass = PLAYER_COLORS[playerIndexMap.get(p.playerId) ?? 0] ?? "player-color-0";
      const label = PLAYER_INITIALS[playerIndexMap.get(p.playerId) ?? 0] ?? p.playerId.slice(0, 2).toUpperCase();
      const isCurrent = p.playerId === view.currentPlayerId;
      const isMe = p.playerId === playerId;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid ${isCurrent ? "rgba(0,212,255,0.4)" : "var(--border-subtle)"};background:${isCurrent ? "rgba(0,212,255,0.06)" : "transparent"};">
          <div class="player-token ${colorClass}" style="position:static;transform:none;width:28px;height:28px;font-size:10px;">${label}</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:${isMe ? "var(--accent-cyan)" : "var(--text-primary)"};">${p.playerId}${isMe ? " (you)" : ""}${isCurrent ? " 🎯" : ""}</div>
            <div style="font-size:10px;color:var(--text-muted);">${p.objectivesRemainingCount} objective${p.objectivesRemainingCount !== 1 ? "s" : ""} left</div>
          </div>
        </div>
      `;
    })
    .join("");

  // My objectives
  const objectivesMarkup =
    myObjectives.length > 0
      ? `<div class="objectives-list">
          ${myObjectives
        .map(
          (obj, i) =>
            `<div class="objective-item" style="${i > 0 ? "opacity:0.6" : ""}">
                  ${i === 0 ? "Next: " : ""}${obj.id}
                </div>`
        )
        .join("")}
        </div>`
      : `<div style="font-size:12px;color:var(--accent-green);font-weight:600;">✓ All collected! Return home!</div>`;

  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>🌀 Labyrinth</h1>
        <div class="status-banner ${statusClass}">
          <span>${statusText}</span>
        </div>
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel">
          ${renderSpareTile(view)}
          <div style="margin-top:16px;" id="labyrinth-insert-controls">
            <div class="labyrinth-insert-ring">
              <div class="insert-row-top" style="display:flex;gap:3px;">${topBtns}</div>
              <div class="insert-col-left" style="display:flex;flex-direction:column;gap:3px;">${leftBtns}</div>
              <div class="labyrinth-board-center" id="labyrinth-board">
                ${renderBoardMarkup(view, playerId)}
              </div>
              <div class="insert-col-right" style="display:flex;flex-direction:column;gap:3px;">${rightBtns}</div>
              <div class="insert-row-bottom" style="display:flex;gap:3px;">${bottomBtns}</div>
            </div>
          </div>
        </div>
        <aside class="side-stack">
          <div class="card side-card">
            <h3>Players</h3>
            <div style="display:grid;gap:6px;">${playersList}</div>
          </div>
          <div class="card side-card">
            <h3>Your Objectives</h3>
            ${objectivesMarkup}
          </div>
          <div class="card debug-panel">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:8px;">Event Log</h3>
            <pre>${logs.slice(0, 15).join("\n") || "No events yet"}</pre>
          </div>
        </aside>
      </div>
    </section>
  `;
}
