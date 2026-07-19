import type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
import { buildCellsFromAnchor } from "./placement-utils";
import { humanizeError, lobbyPanelMarkup } from "../../templates/lobby";
import { icon } from "../../icons";

export function renderPlacementBoardMarkup(
  definition: BattleshipDefinition,
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  selectedShipId: string,
  shipPreview: Record<string, string>
): string {
  const occupied = new Set<string>();
  for (const spec of specs) {
    const draft = draftMap[spec.id];
    if (!draft) continue;
    for (const cell of buildCellsFromAnchor(draft, spec.size)) {
      occupied.add(`${cell.row},${cell.col}`);
    }
  }

  const selectedSpec = specs.find((spec) => spec.id === selectedShipId);
  const selectedDraft = selectedSpec ? draftMap[selectedShipId] : undefined;
  const selectedCoverage = new Set<string>();
  if (selectedSpec && selectedDraft) {
    for (const cell of buildCellsFromAnchor(selectedDraft, selectedSpec.size)) {
      selectedCoverage.add(`${cell.row},${cell.col}`);
    }
  }

  const cells: string[] = [];
  for (let row = 0; row < definition.board.rows; row += 1) {
    for (let col = 0; col < definition.board.cols; col += 1) {
      const classes = ["placement-cell"];
      const key = `${row},${col}`;
      if (occupied.has(key)) classes.push("occupied");
      if (selectedCoverage.has(key)) classes.push("selected-cell");
      if (selectedDraft && selectedDraft.row === row && selectedDraft.col === col) {
        classes.push("selected-anchor");
      }
      cells.push(
        `<button class="${classes.join(" ")}" data-r="${row}" data-c="${col}" aria-label="Cell ${row},${col}"></button>`
      );
    }
  }

  const shipSprites = specs
    .map((spec) => {
      const draft = draftMap[spec.id];
      if (!draft) return "";
      const isHorizontal = draft.rotationDeg % 180 === 0;
      const widthCells = isHorizontal ? spec.size : 1;
      const heightCells = isHorizontal ? 1 : spec.size;
      const isSelected = selectedShipId === spec.id;

      // The div spans its exact footprint via the CSS grid vars below, so a
      // solid block always fits the cells. (Sprite art was overflowing its
      // slot; a labelled block is correct and legible — polish later.)
      return `<div
        class="placement-ship ${isSelected ? "selected" : ""}"
        data-ship-id="${spec.id}"
        style="--ship-row:${draft.row};--ship-col:${draft.col};--ship-width:${widthCells};--ship-height:${heightCells};"
        title="${spec.id} — click to select, right-click board to rotate"
      >
        <span class="placement-ship-label" style="${isHorizontal ? "" : "writing-mode:vertical-rl;"}">${spec.id}</span>
        ${isSelected ? `<div class="ship-selected-ring"></div>` : ""}
      </div>`;
    })
    .join("");

  return `
    <div class="placement-grid">${cells.join("")}</div>
    <div class="placement-ships-layer">${shipSprites}</div>
  `;
}

export function renderBattleshipLobby(sessionId: string, playerId: string, error?: string | null): string {
  return `
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>${icon("anchor", 22)} Battleship</h1>
        <p>Join a session with your fleet commander identity to start the battle.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Mission Lobby",
    joinLabel: "Join Mission",
    error,
    vsBot: true,
    hint: "Open two browser windows with the same Game Code but different names to play locally."
  })}
    </section>
  `;
}

function fleetIconBlocks(size: number, isSelected: boolean, imgSrc: string): string {
  if (imgSrc) {
    return `<img src="${imgSrc}" alt="" style="width:auto;height:20px;image-rendering:pixelated;transform:rotate(90deg);opacity:${isSelected ? 1 : 0.7}" />`;
  }
  return Array.from({ length: size }, () =>
    `<div class="ship-block ${isSelected ? "active-block" : ""}"></div>`
  ).join("");
}

export function renderBattleshipSetup(
  definition: BattleshipDefinition,
  fleetSubmitted: boolean,
  sessionId: string,
  playerId: string,
  placementDraftMap: Record<string, PlacementDraft>,
  selectedShipId: string,
  shipPreview: Record<string, string>,
  localError: string | null,
  stateLastError: string | null | undefined
): string {
  const allPlaced = definition.ships.every((ship) => !!placementDraftMap[ship.id]);
  const waitingForOpponent = fleetSubmitted;

  const ERROR_MESSAGES: Record<string, string> = {
    illegal_action: "Action not allowed — the game may already be in progress. Try rejoining.",
    ship_out_of_bounds: "Ship extends outside the board. Try a different position.",
    ship_overlap_collision: "Ships can't overlap. Choose a clear area.",
    rotation_out_of_bounds: "Not enough space to rotate here.",
    rotation_collision: "Rotating would cause a collision.",
    setup_incomplete_or_invalid: "All ships must be placed before submitting.",
    session_not_found: "Session not found. Check the session ID and try rejoining.",
  };
  const rawError = localError ?? stateLastError ?? "";
  const errorText = rawError ? (ERROR_MESSAGES[rawError] ?? rawError) : "";

  if (waitingForOpponent) {
    return `
      <section class="screen battleship-screen">
        <div class="section-head">
          <h1>${icon("anchor", 22)} Battleship Setup</h1>
        </div>
        <div class="waiting-banner">
          <div class="waiting-dot"></div>
          <span>Fleet submitted! Waiting for opponent to complete their setup…</span>
        </div>
      </section>
    `;
  }

  return `
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>${icon("anchor", 22)} Fleet Deployment</h1>
        <p>Position your fleet before the battle begins. <strong>Click a ship to select it</strong>, then click a cell to place it. Right-click to rotate.</p>
      </div>
      <div class="setup-layout">
        <aside class="card fleet-panel">
          <h3>Fleet Manifest</h3>
          <div class="fleet-ships">
            ${definition.ships
      .map(
        (ship) => {
          const isSelected = selectedShipId === ship.id;
          const isPlaced = !!placementDraftMap[ship.id];
          return `
                  <button class="fleet-row fleet-button ${isSelected ? "active" : ""}" data-ship-id="${ship.id}">
                    <div class="fleet-icons">${fleetIconBlocks(ship.size, isSelected, shipPreview[ship.id] ?? "")}</div>
                    <span class="ship-name">${ship.id}</span>
                    <span class="ship-size">×${ship.size}</span>
                    <span class="ship-status-badge ${isPlaced ? "placed" : "unplaced"}">${isPlaced ? "✓" : "—"}</span>
                  </button>
                `;
        }
      )
      .join("")}
          </div>
          <div class="fleet-actions">
            <button class="btn btn-secondary" id="load-template-btn" style="width:100%">↓ Load Valid Fleet</button>
            <button class="btn btn-ghost" id="random-template-btn" style="width:100%">⚄ Randomize</button>
          </div>
        </aside>
        <section class="card setup-editor">
          <h3>Placement Grid</h3>
          <div class="setup-controls">
            <button class="btn btn-ghost" id="rotate-btn">↻ Rotate</button>
            <button class="btn btn-ghost" id="clear-ship-btn">✕ Clear</button>
            ${errorText ? `<span class="error-text">${errorText}</span>` : ""}
          </div>
          <div class="placement-board" id="placement-board">
            ${renderPlacementBoardMarkup(definition, definition.ships as ShipSpec[], placementDraftMap, selectedShipId, shipPreview)}
          </div>
          <div class="row-actions" style="margin-top:12px">
            <button class="btn btn-primary" id="submit-setup-btn" ${allPlaced ? "" : 'disabled aria-disabled="true"'}>
              ${allPlaced ? "Submit Fleet" : "Place all ships to continue"}
            </button>
            <button class="btn btn-ghost" id="rejoin-btn">⟲ Rejoin</button>
          </div>
        </section>
      </div>
    </section>
  `;
}

function lastShotText(events: unknown[]): string {
  let text = "";
  for (const raw of events) {
    const event = raw as { eventType?: string; payload?: { shipId?: string } };
    if (event.eventType === "ship.sunk") return `Sunk their ${event.payload?.shipId ?? "ship"}!`;
    if (event.eventType === "shot.hit") text = "Hit!";
    else if (event.eventType === "shot.miss" && !text) text = "Miss";
  }
  return text;
}

export function renderBattleshipGameplay(
  phase: string,
  view: ClientView,
  canFire: boolean,
  boardMarkup: string,
  logs: string[],
  _stateDump: string,
  status: { seatNames?: Record<string, string>; lastError?: string | null; lastEvents?: unknown[] } = {}
): string {
  const isTerminal = phase === "terminal";
  const winner = view.winnerPlayerId;
  const nameOf = (id: string | null | undefined): string =>
    id ? status.seatNames?.[id] ?? id : "";

  if (isTerminal) {
    return `
      <section class="screen battleship-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">${icon("trophy", 46)}</div>
          <h2>Game Over!</h2>
          <p>${winner ? `<strong>${nameOf(winner)}</strong> wins the battle!` : "It's a draw!"}</p>
          <div class="row-actions" style="justify-content:center">
            <button class="btn btn-primary" id="rematch-btn">⟲ Play Again</button>
            <a class="btn btn-ghost" href="#/">← Back to Hub</a>
          </div>
        </div>
      </section>
    `;
  }

  const statusClass = canFire ? "your-turn" : "their-turn";
  const currentName = nameOf(view.currentPlayerId);
  const statusText = canFire
    ? "Your turn — click on the <strong>Opponent Board</strong> to fire"
    : currentName.startsWith("Computer")
      ? `${icon("robot", 14)} <strong>${currentName}</strong> is thinking<span class="thinking-dots"></span>`
      : `${icon("hourglass", 13)} Waiting for <strong>${currentName || "opponent"}</strong>`;
  const errorText = humanizeError(status.lastError);
  const resultText = lastShotText(status.lastEvents ?? []);

  return `
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>${icon("anchor", 22)} Live Battle</h1>
        <div class="status-banner ${statusClass}">
          <span>${statusText}</span>
        </div>
        ${resultText ? `<div class="status-banner last-result"><span>${resultText}</span></div>` : ""}
        ${errorText ? `<div class="error-text" role="alert">${errorText}</div>` : ""}
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel" id="render-view">
          ${boardMarkup}
        </div>
        <aside class="side-stack">
          <div class="card side-card">
            <h3>Battle Log</h3>
            <pre style="max-height:200px;overflow:auto;font-size:10px;color:var(--text-muted);font-family:'Inter',monospace;white-space:pre-wrap;line-height:1.5">${logs.slice(0, 20).join("\n") || "No events yet"}</pre>
          </div>
        </aside>
      </div>
    </section>
  `;
}
