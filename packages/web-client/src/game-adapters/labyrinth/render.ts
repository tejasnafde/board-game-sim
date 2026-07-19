import { humanizeError, lobbyPanelMarkup } from "../../templates/lobby";
import { icon, objectiveIcon } from "../../icons";
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

  return `<svg class="tile-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${paths}
  </svg>`;
}

function renderBoardMarkup(view: LabyrinthView, playerId: string): string {
  const board = view.board ?? [];
  const reachable = new Set(
    (view.myState?.reachableCells ?? []).map((cell) => `${cell.row},${cell.col}`)
  );
  const players = view.players ?? [];
  const nextObjectiveId = view.myState?.remainingObjectives?.[0]?.id ?? null;
  const home = view.myState?.home ?? null;
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
      const isNextObjective = objectiveId !== null && objectiveId === nextObjectiveId;
      const isHome = home !== null && home.row === row && home.col === col;
      const classes = ["labyrinth-cell"];
      if (isReachable) classes.push("reachable");
      if (isNextObjective) classes.push("next-objective");

      const playerTokens = playersHere
        .map((p) => {
          const colorClass = PLAYER_COLORS[playerIndexMap.get(p.playerId) ?? 0] ?? "player-color-0";
          const label = PLAYER_INITIALS[playerIndexMap.get(p.playerId) ?? 0] ?? p.playerId.slice(0, 2).toUpperCase();
          return `<div class="player-token ${colorClass}">${label}</div>`;
        })
        .join("");

      const glow = isNextObjective
        ? ' style="outline:2px solid #fbbf24;outline-offset:-2px;box-shadow:0 0 10px rgba(251,191,36,0.8);z-index:1;"'
        : "";
      const objectiveMarker = objectiveId
        ? `<div class="objective-marker ${isNextObjective ? "next" : ""}" title="${objectiveId}">${objectiveIcon(objectiveId, 15)}</div>`
        : "";
      const homeMarker = isHome
        ? `<div class="home-marker" title="your home">${icon("home", 13)}</div>`
        : "";

      cells.push(
        `<button class="${classes.join(" ")}"${glow} data-lab-cell="1" data-r="${row}" data-c="${col}" title="${objectiveId ?? ""}">
          ${tileCorridorSvg(openings, objectiveId)}
          ${objectiveMarker}
          ${homeMarker}
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
      <div class="spare-tile-box" style="position:relative;">
        ${tileCorridorSvg(openings, tile.objectiveId ?? null)}
        ${tile.objectiveId ? `<div class="objective-marker" title="${tile.objectiveId}">${objectiveIcon(tile.objectiveId, 13)}</div>` : ""}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.08em;">Spare Tile</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Insert from any arrow</div>
      </div>
    </div>
  `;
}

export function renderLabyrinthLobby(
  sessionId: string,
  playerId: string,
  error?: string | null,
  seatCount = 2
): string {
  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>${icon("maze", 24)} Labyrinth</h1>
        <p>Navigate the shifting maze. Insert the spare tile, move your pawn, collect objectives and return home to win.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Maze Lobby",
    joinLabel: "Enter Maze",
    error,
    seatCount,
    vsBot: true
  })}
    </section>
  `;
}

const OPPOSITE_EDGE: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left"
};

function activityMarkup(
  view: LabyrinthView,
  playerId: string,
  nameOf: (id: string | null | undefined) => string,
  lastEvents: unknown[]
): string {
  const lines: string[] = [];
  for (const raw of lastEvents) {
    const event = raw as { eventType?: string; payload?: { playerId?: string; objectiveId?: string } };
    if (event.eventType === "objective.collected" && event.payload?.objectiveId) {
      const who = event.payload.playerId === playerId ? "You" : nameOf(event.payload.playerId);
      lines.push(
        `<div class="activity-line">${objectiveIcon(event.payload.objectiveId, 14)} <strong>${who}</strong> collected the ${event.payload.objectiveId}</div>`
      );
    }
  }
  for (const p of view.players ?? []) {
    if (p.playerId !== playerId && p.objectivesRemainingCount === 0) {
      lines.push(
        `<div class="activity-line danger">${icon("home", 14)} <strong>${nameOf(p.playerId)}</strong> has every objective — racing home!</div>`
      );
    }
  }
  return lines.join("");
}

export function renderLabyrinthGameplay(
  view: LabyrinthView,
  playerId: string,
  logs: string[],
  _stateDump: string,
  status: { seatNames?: Record<string, string>; lastError?: string | null; lastEvents?: unknown[] } = {}
): string {
  const insertionIndexes = view.config?.insertionIndexes ?? [1, 3, 5];
  const isTerminal = view.phase === "terminal";
  const isMyTurn = view.currentPlayerId === playerId;
  const isInsertStage = view.turnStage === "insert";
  const isMoveStage = view.turnStage === "move";
  const myObjectives = view.myState?.remainingObjectives ?? [];
  const players = view.players ?? [];
  const nameOf = (id: string | null | undefined): string =>
    id ? status.seatNames?.[id] ?? id : "";
  // The server rejects pushing the spare tile straight back where it came from.
  const last = view.lastInsertion;
  const isReverse = (edge: string, index: number): boolean =>
    !!last && OPPOSITE_EDGE[last.edge] === edge && last.index === index;

  if (isTerminal) {
    return `
      <section class="screen labyrinth-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">${icon("trophy", 46)}</div>
          <h2>Maze Conquered!</h2>
          <p>${view.winnerPlayerId ? `<strong>${nameOf(view.winnerPlayerId)}</strong> collected all objectives and returned home!` : "Someone found the way home!"}</p>
          <div class="final-scores">
            ${(view.players ?? [])
              .map((p) => `<div class="final-score-row"><strong>${nameOf(p.playerId)}</strong> ${(p.collectedObjectiveIds ?? [])
                .map((id: string) => objectiveIcon(id, 15))
                .join("")} ${(p.collectedObjectiveIds ?? []).length} collected</div>`)
              .join("")}
          </div>
          <div class="row-actions" style="justify-content:center">
            <button class="btn btn-primary" id="rematch-btn">⟲ Play Again</button>
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
          <h1>${icon("maze", 24)} Labyrinth</h1>
        </div>
        <div class="card" style="max-width:500px;text-align:center;padding:var(--sp-8);">
          <div class="waiting-dot" style="margin:0 auto var(--sp-4);"></div>
          <h3>Waiting for the game to start…</h3>
          <p style="color:var(--text-muted);margin-top:8px;font-size:14px;">The maze will appear once all players have joined. Share the Session ID with your friends to begin.</p>
          <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:rgba(0,212,255,0.06);border-radius:var(--r-md);border:1px solid var(--border-subtle);">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:4px;">Players joined</div>
            ${view.players && view.players.length > 0
        ? view.players.map(p => `<div style="font-size:13px;color:var(--text-secondary);">${nameOf(p.playerId)}</div>`).join('')
        : '<div style="font-size:13px;color:var(--text-muted);">Waiting for players…</div>'
      }
          </div>
        </div>
      </section>
    `;
  }

  // Status banner
  let statusClass = "their-turn";
  const currentName = nameOf(view.currentPlayerId);
  let statusText = currentName.startsWith("Computer")
    ? `${icon("robot", 14)} <strong>${currentName}</strong> is thinking<span class="thinking-dots"></span>`
    : `${icon("hourglass", 13)} Waiting for <strong>${currentName || "other player"}</strong>`;
  if (isMyTurn && isInsertStage) {
    statusClass = "your-turn";
    statusText = "Your turn — insert the spare tile using an arrow button";
  } else if (isMyTurn && isMoveStage) {
    statusClass = "your-turn";
    statusText = "Now move your pawn — click a highlighted cell";
  }

  // Build insertion ring around the board
  // Top row buttons: for insertionIndexes → "top, index"
  const cols = view.board?.[0]?.length ?? 7;
  const rows = view.board?.length ?? 7;

  const topBtns = Array.from({ length: cols }, (_, col) => {
    const isSlot = insertionIndexes.includes(col);
    const disabled = !isSlot || !isMyTurn || !isInsertStage || isReverse("top", col) ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn ${last && last.edge === "top" && last.index === col ? "just-used" : ""}" data-edge="top" data-index="${col}" ${disabled} title="Insert top column ${col}">▼</button>`
      : `<div></div>`;
  }).join("");

  const bottomBtns = Array.from({ length: cols }, (_, col) => {
    const isSlot = insertionIndexes.includes(col);
    const disabled = !isSlot || !isMyTurn || !isInsertStage || isReverse("bottom", col) ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn ${last && last.edge === "bottom" && last.index === col ? "just-used" : ""}" data-edge="bottom" data-index="${col}" ${disabled} title="Insert bottom column ${col}">▲</button>`
      : `<div></div>`;
  }).join("");

  const leftBtns = Array.from({ length: rows }, (_, row) => {
    const isSlot = insertionIndexes.includes(row);
    const disabled = !isSlot || !isMyTurn || !isInsertStage || isReverse("left", row) ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn ${last && last.edge === "left" && last.index === row ? "just-used" : ""}" data-edge="left" data-index="${row}" ${disabled} title="Insert left row ${row}">▶</button>`
      : `<div></div>`;
  }).join("");

  const rightBtns = Array.from({ length: rows }, (_, row) => {
    const isSlot = insertionIndexes.includes(row);
    const disabled = !isSlot || !isMyTurn || !isInsertStage || isReverse("right", row) ? "disabled" : "";
    return isSlot
      ? `<button class="insert-btn labyrinth-insert-btn ${last && last.edge === "right" && last.index === row ? "just-used" : ""}" data-edge="right" data-index="${row}" ${disabled} title="Insert right row ${row}">◀</button>`
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
            <div style="font-size:12px;font-weight:600;color:${isMe ? "var(--accent-cyan)" : "var(--text-primary)"};">${nameOf(p.playerId)}${isMe ? " (you)" : ""}${isCurrent ? ` ${icon("target", 11)}` : ""}</div>
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
                  ${objectiveIcon(obj.id, 15)} ${i === 0 ? "Next: " : ""}${obj.id}
                </div>`
        )
        .join("")}
        </div>`
      : `<div style="font-size:12px;color:var(--accent-green);font-weight:600;">✓ All collected! Return home!</div>`;

  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>${icon("maze", 24)} Labyrinth</h1>
        <div class="status-banner ${statusClass}">
          <span>${statusText}</span>
        </div>
        ${status.lastError ? `<div class="error-text" role="alert">${humanizeError(status.lastError)}</div>` : ""}
        ${activityMarkup(view, playerId, nameOf, status.lastEvents ?? [])}
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel">
          ${renderSpareTile(view)}
          <div style="margin-top:16px;" id="labyrinth-insert-controls">
            <div class="labyrinth-insert-ring">
              <div class="insert-row-top" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:3px;width:100%;max-width:560px;margin:0 auto;padding:0 4px;">${topBtns}</div>
              <div class="insert-col-left" style="display:grid;grid-template-rows:repeat(${rows},minmax(0,1fr));gap:3px;padding:4px 0;">${leftBtns}</div>
              <div class="labyrinth-board-center" id="labyrinth-board">
                ${renderBoardMarkup(view, playerId)}
              </div>
              <div class="insert-col-right" style="display:grid;grid-template-rows:repeat(${rows},minmax(0,1fr));gap:3px;padding:4px 0;">${rightBtns}</div>
              <div class="insert-row-bottom" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:3px;width:100%;max-width:560px;margin:0 auto;padding:0 4px;">${bottomBtns}</div>
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
