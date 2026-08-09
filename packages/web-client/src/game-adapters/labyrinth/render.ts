import { humanizeError, lobbyPanelMarkup, terminalBannerMarkup } from "../../templates/lobby";
import { icon, objectiveIcon } from "../../icons";
import { findPath } from "@board-game-sim/labyrinth";
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

function renderBoardMarkup(view: LabyrinthView, playerId: string, decorations: Decorations): string {
  const board = view.board ?? [];
  const reachable = new Set(
    (view.myState?.reachableCells ?? []).map((cell) => `${cell.row},${cell.col}`)
  );
  const players = view.players ?? [];
  const nextObjectiveId = view.myState?.remainingObjectives?.[0]?.id ?? null;
  const homeOwners = new Map<string, number>();
  (view.players ?? []).forEach((p, i) => {
    if (p.home) homeOwners.set(`${p.home.row}:${p.home.col}`, i);
  });
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
      const homeOwner = homeOwners.get(`${row}:${col}`);
      const classes = ["labyrinth-cell"];
      if (isReachable) classes.push("reachable");
      if (isNextObjective) classes.push("next-objective");
      if (decorations.laneCells.has(`${row}:${col}`)) classes.push("lane-shifted");
      if (decorations.trailCells.has(`${row}:${col}`)) classes.push("trail");

      const playerTokens = playersHere
        .map((p) => {
          const colorClass = PLAYER_COLORS[playerIndexMap.get(p.playerId) ?? 0] ?? "player-color-0";
          const label = PLAYER_INITIALS[playerIndexMap.get(p.playerId) ?? 0] ?? p.playerId.slice(0, 2).toUpperCase();
          const moved = decorations.movedPlayerId === p.playerId ? " just-moved" : "";
          return `<div class="player-token ${colorClass}${moved}">${label}</div>`;
        })
        .join("");

      const glow = isNextObjective
        ? ' style="outline:2px solid var(--warn);outline-offset:-2px;z-index:1;"'
        : "";
      const objectiveMarker = objectiveId
        ? `<div class="objective-marker ${isNextObjective ? "next" : ""}" title="${objectiveId}">${objectiveIcon(objectiveId, 15)}</div>`
        : "";
      const homeMarker = homeOwner !== undefined
        ? `<div class="home-marker owner-${homeOwner}" title="${homeOwner === playerIndexMap.get(playerId) ? "your home" : "home corner"}">${icon("home", 14)}</div>`
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

function renderSpareTile(view: LabyrinthView, changed = false): string {
  if (!view.spareTile) return "";
  const tile = view.spareTile as { openings?: Openings; objectiveId?: string | null };
  const openings = tile.openings ?? { N: false, E: false, S: false, W: false };
  return `
    <div class="spare-tile-wrap">
      <div class="spare-tile-box ${changed ? "spare-changed" : ""}" style="position:relative;">
        ${tileCorridorSvg(openings, tile.objectiveId ?? null)}
        ${tile.objectiveId ? `<div class="objective-marker" title="${tile.objectiveId}">${objectiveIcon(tile.objectiveId, 13)}</div>` : ""}
      </div>
      <div>
        <div class="label" style="color:var(--warn);">Spare Tile</div>
        <div style="font-size:11px;color:var(--ink-3);margin-top:2px;">Insert from any arrow</div>
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

type Decorations = {
  trailCells: Set<string>;
  laneCells: Set<string>;
  movedPlayerId: string | null;
  spareChanged: boolean;
};

// Full re-render per event means "what just changed" must be remembered across
// renders; decorations stay live long enough for their fade animations.
let prevSnapshot: { key: string; positions: Record<string, string>; spareId: string | null; insertion: string } | null = null;
let liveDecoration: (Decorations & { until: number }) | null = null;

function diffDecorations(view: LabyrinthView, myId: string): Decorations {
  const none: Decorations = { trailCells: new Set(), laneCells: new Set(), movedPlayerId: null, spareChanged: false };
  const players = view.players ?? [];
  const key = players.map((p) => p.playerId).join(",");
  const positions: Record<string, string> = {};
  for (const p of players) positions[p.playerId] = `${p.position.row}:${p.position.col}`;
  const spareId = (view.spareTile as { id?: string } | undefined)?.id ?? null;
  const insertion = view.lastInsertion ? `${view.lastInsertion.edge}:${view.lastInsertion.index}` : "";

  const prev = prevSnapshot;
  prevSnapshot = { key, positions, spareId, insertion };

  if (prev && prev.key === key) {
    if (prev.insertion !== insertion && view.lastInsertion) {
      const lane = new Set<string>();
      const { edge, index } = view.lastInsertion;
      const size = { rows: view.config?.rows ?? 7, cols: view.config?.cols ?? 7 };
      if (edge === "top" || edge === "bottom") {
        for (let row = 0; row < size.rows; row += 1) lane.add(`${row}:${index}`);
      } else {
        for (let col = 0; col < size.cols; col += 1) lane.add(`${index}:${col}`);
      }
      liveDecoration = { ...none, laneCells: lane, spareChanged: prev.spareId !== spareId, until: Date.now() + 1200 };
    } else {
      const mover = players.find((p) => p.playerId !== myId && prev.positions[p.playerId] && prev.positions[p.playerId] !== positions[p.playerId]);
      if (mover && view.board) {
        const [row, col] = prev.positions[mover.playerId]!.split(":").map(Number);
        const size = { rows: view.config?.rows ?? 7, cols: view.config?.cols ?? 7 };
        const path = findPath(view.board as never, size, { row: row!, col: col! }, mover.position);
        liveDecoration = {
          trailCells: new Set((path ?? []).map((c) => `${c.row}:${c.col}`)),
          laneCells: new Set(),
          movedPlayerId: mover.playerId,
          spareChanged: false,
          until: Date.now() + 1700
        };
      }
    }
  }

  if (liveDecoration && liveDecoration.until > Date.now()) return liveDecoration;
  liveDecoration = null;
  return none;
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
        `<div class="activity-line danger">${icon("home", 14)} <strong>${nameOf(p.playerId)}</strong> has every objective - racing home!</div>`
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
  const decorations = diffDecorations(view, playerId);
  const isTerminal = view.phase === "terminal";
  const isMyTurn = !isTerminal && view.currentPlayerId === playerId;
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


  // Board not populated yet - game hasn't started
  if (!view.board || view.board.length === 0) {
    return `
      <section class="screen labyrinth-screen">
        <div class="section-head">
          <h1>${icon("maze", 24)} Labyrinth</h1>
        </div>
        <div class="card" style="max-width:500px;text-align:center;padding:var(--sp-8);">
          <div class="waiting-dot" style="margin:0 auto var(--sp-4);"></div>
          <h3>Waiting for the game to start…</h3>
          <p style="color:var(--ink-3);margin-top:8px;font-size:14px;">The maze will appear once all players have joined. Share the Session ID with your friends to begin.</p>
          <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:var(--accent-subtle);border-radius:var(--r);border:1px solid var(--line);">
            <div class="label" style="margin-bottom:4px;">Players joined</div>
            ${view.players && view.players.length > 0
        ? view.players.map(p => `<div style="font-size:13px;color:var(--ink-2);">${nameOf(p.playerId)}</div>`).join('')
        : '<div style="font-size:13px;color:var(--ink-3);">Waiting for players…</div>'
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
    statusText = "Your turn - insert the spare tile using an arrow button";
  } else if (isMyTurn && isMoveStage) {
    statusClass = "your-turn";
    statusText = "Now move your pawn - click a highlighted cell";
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
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid ${isCurrent ? "var(--accent)" : "var(--line)"};background:${isCurrent ? "var(--accent-subtle)" : "transparent"};">
          <div class="player-token ${colorClass}" style="position:static;transform:none;width:28px;height:28px;font-size:10px;">${label}</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:${isMe ? "var(--accent)" : "var(--ink)"};">${nameOf(p.playerId)}${isMe ? " (you)" : ""}${isCurrent ? ` ${icon("target", 11)}` : ""}</div>
            <div style="font-size:10px;color:var(--ink-3);"><span class="num">${p.objectivesRemainingCount}</span> objective${p.objectivesRemainingCount !== 1 ? "s" : ""} left</div>
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
      : `<div style="font-size:12px;color:var(--pos);font-weight:600;">All collected! Return home!</div>`;

  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>${icon("maze", 24)} Labyrinth</h1>
        ${isTerminal
          ? terminalBannerMarkup(
              view.winnerPlayerId === playerId
                ? "You conquered the maze!"
                : `${nameOf(view.winnerPlayerId)} conquered the maze!`,
              (view.players ?? [])
                .map((p) => `<span class="num">${nameOf(p.playerId)} ${(p.collectedObjectiveIds ?? []).length}</span>`)
                .join(" · ")
            )
          : `<div class="status-banner ${statusClass}">
          <span>${statusText}</span>
        </div>`}
        ${status.lastError ? `<div class="error-text" role="alert">${humanizeError(status.lastError)}</div>` : ""}
        ${activityMarkup(view, playerId, nameOf, status.lastEvents ?? [])}
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel">
          <div id="labyrinth-insert-controls">
            <div class="labyrinth-insert-ring">
              ${renderSpareTile(view, decorations.spareChanged)}
              <div class="insert-row-top" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:3px;width:100%;max-width:560px;margin:0 auto;padding:0 4px;">${topBtns}</div>
              <div class="insert-col-left" style="display:grid;grid-template-rows:repeat(${rows},minmax(0,1fr));gap:3px;padding:4px 0;">${leftBtns}</div>
              <div class="labyrinth-board-center" id="labyrinth-board">
                ${renderBoardMarkup(view, playerId, decorations)}
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
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-3);margin-bottom:8px;">Event Log</h3>
            <pre>${logs.slice(0, 15).join("\n") || "No events yet"}</pre>
          </div>
        </aside>
      </div>
    </section>
  `;
}
