import type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
import { buildCellsFromAnchor } from "./placement-utils";
import { humanizeError, lobbyPanelMarkup, terminalBannerMarkup } from "../../templates/lobby";
import { icon } from "../../icons";

export type ShipPreview = {
  url: string;
  nativeFacing?: "north" | "east" | "south" | "west";
};

function normalizeShipPreview(preview: ShipPreview | string | undefined): ShipPreview {
  return typeof preview === "string" ? { url: preview, nativeFacing: "north" } : (preview ?? { url: "" });
}

function facingAngle(facing: ShipPreview["nativeFacing"]): number {
  return { north: 270, east: 0, south: 90, west: 180 }[facing ?? "north"];
}

export function renderPlacementBoardMarkup(
  definition: BattleshipDefinition,
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  selectedShipId: string,
  shipPreview: Record<string, ShipPreview | string>
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
      const shipCells = buildCellsFromAnchor(draft, spec.size);
      const rows = shipCells.map((cell) => cell.row);
      const cols = shipCells.map((cell) => cell.col);
      const startRow = Math.min(...rows);
      const startCol = Math.min(...cols);
      const isHorizontal = draft.rotationDeg % 180 === 0;
      const widthCells = Math.max(...cols) - startCol + 1;
      const heightCells = Math.max(...rows) - startRow + 1;
      const preview = normalizeShipPreview(shipPreview[spec.id]);
      const artRotation = (draft.rotationDeg - facingAngle(preview.nativeFacing) + 360) % 360;
      const nativeAxis = preview.nativeFacing === "east" || preview.nativeFacing === "west"
        ? "native-horizontal"
        : "native-vertical";
      const isSelected = selectedShipId === spec.id;

      return `<div
        class="placement-ship ${isHorizontal ? "is-horizontal" : "is-vertical"} ${nativeAxis} ${isSelected ? "selected" : ""}"
        data-ship-id="${spec.id}"
        style="--ship-row:${startRow};--ship-col:${startCol};--ship-width:${widthCells};--ship-height:${heightCells};--ship-size:${spec.size};--ship-art-rotation:${artRotation}deg;"
        title="${spec.id} - click to select, right-click board to rotate"
      >
        <img class="placement-ship-art" src="${preview.url}" alt="" />
        <span class="placement-ship-label">${spec.id}</span>
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

function fleetIconBlocks(size: number, isSelected: boolean, input: ShipPreview | string | undefined): string {
  const preview = normalizeShipPreview(input);
  if (preview.url) {
    const rotation = (0 - facingAngle(preview.nativeFacing) + 360) % 360;
    return `<img src="${preview.url}" alt="" style="width:auto;height:20px;transform:rotate(${rotation}deg);opacity:${isSelected ? 1 : 0.7}" />`;
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
  shipPreview: Record<string, ShipPreview | string>,
  localError: string | null,
  stateLastError: string | null | undefined
): string {
  const allPlaced = definition.ships.every((ship) => !!placementDraftMap[ship.id]);
  const waitingForOpponent = fleetSubmitted;

  const ERROR_MESSAGES: Record<string, string> = {
    illegal_action: "Action not allowed - the game may already be in progress. Try rejoining.",
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
                    <div class="fleet-icons">${fleetIconBlocks(ship.size, isSelected, shipPreview[ship.id])}</div>
                    <span class="ship-name">${ship.id}</span>
                    <span class="ship-size num">x${ship.size}</span>
                    <span class="ship-status-dot ${isPlaced ? "placed" : ""}" role="img" aria-label="${isPlaced ? "placed" : "not placed"}"></span>
                  </button>
                `;
        }
      )
      .join("")}
          </div>
          <div class="fleet-actions">
            <button class="btn btn-secondary" id="load-template-btn" style="width:100%">Load Valid Fleet</button>
            <button class="btn btn-ghost" id="random-template-btn" style="width:100%">Randomize</button>
          </div>
        </aside>
        <section class="card setup-editor">
          <h3>Placement Grid</h3>
          <div class="setup-controls">
            <button class="btn btn-ghost" id="rotate-btn">Rotate</button>
            <button class="btn btn-ghost" id="clear-ship-btn">Clear</button>
            ${errorText ? `<span class="error-text">${errorText}</span>` : ""}
          </div>
          <div class="placement-board" id="placement-board">
            ${renderPlacementBoardMarkup(definition, definition.ships as ShipSpec[], placementDraftMap, selectedShipId, shipPreview)}
          </div>
          <div class="row-actions" style="margin-top:12px">
            <button class="btn btn-primary" id="submit-setup-btn" ${allPlaced ? "" : 'disabled aria-disabled="true"'}>
              ${allPlaced ? "Submit Fleet" : "Place all ships to continue"}
            </button>
            <button class="btn btn-ghost" id="rejoin-btn">Rejoin</button>
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

function recentSalvoMarkup(events: unknown[]): string {
  let result = "No salvos recorded";
  let detail = "Select a coordinate on the targeting grid.";

  for (const raw of events) {
    const event = raw as {
      eventType?: string;
      payload?: { at?: { row?: number; col?: number }; shipId?: string };
    };
    const at = event.payload?.at;
    const coordinate = at && at.row !== undefined && at.col !== undefined
      ? `${String.fromCharCode(65 + at.col)}${at.row + 1}`
      : "";
    if (event.eventType === "shot.miss") {
      result = "Water only";
      detail = coordinate ? `${coordinate} was a miss.` : "The last salvo missed.";
    }
    if (event.eventType === "shot.hit") {
      result = "Hit confirmed";
      detail = `${coordinate ? `${coordinate} struck` : "Impact on"} ${event.payload?.shipId ?? "a ship"}.`;
    }
    if (event.eventType === "ship.sunk") {
      result = "Vessel destroyed";
      detail = `${event.payload?.shipId ?? "Enemy ship"} is beneath the waves.`;
    }
  }

  return `<div class="salvo-result">
    <strong>${result}</strong>
    <span>${detail}</span>
  </div>`;
}

export function renderBattleshipGameplay(
  phase: string,
  view: ClientView,
  canFire: boolean,
  boardMarkup: string,
  logs: string[],
  _stateDump: string,
  status: {
    seatNames?: Record<string, string>;
    lastError?: string | null;
    lastEvents?: unknown[];
    mySeat?: string;
  } = {}
): string {
  const isTerminal = phase === "terminal";
  const winner = view.winnerPlayerId;
  const nameOf = (id: string | null | undefined): string =>
    id ? status.seatNames?.[id] ?? id : "";


  const statusClass = canFire ? "your-turn" : "their-turn";
  const currentName = nameOf(view.currentPlayerId);
  const statusText = canFire
    ? "Your turn - click on the <strong>Opponent Board</strong> to fire"
    : currentName.startsWith("Computer")
      ? `${icon("robot", 14)} <strong>${currentName}</strong> is thinking<span class="thinking-dots"></span>`
      : `${icon("hourglass", 13)} Waiting for <strong>${currentName || "opponent"}</strong>`;
  const errorText = humanizeError(status.lastError);
  const resultText = lastShotText(status.lastEvents ?? []);
  const ownShips = view.ownBoard?.ships ?? [];
  const totalHullCells = ownShips.reduce((count, ship) => count + ship.cells.length, 0);
  const hitsTaken = view.ownBoard?.hitsTaken?.length ?? 0;
  const intactHullCells = Math.max(0, totalHullCells - hitsTaken);
  const fleetPercent = totalHullCells > 0 ? Math.round((intactHullCells / totalHullCells) * 100) : 100;
  const opponentName = Object.entries(status.seatNames ?? {}).find(([seat]) => seat !== status.mySeat)?.[1]
    ?? "Opponent";

  return `
    <section class="screen battleship-screen">
      <header class="battle-command-header">
        <div class="battle-title-block">
          <span class="battle-kicker">Naval command · ${opponentName}</span>
          <h1>${icon("anchor", 22)} Live Battle</h1>
        </div>
        ${isTerminal
          ? terminalBannerMarkup(
              winner === null ? "It's a draw!" : `${nameOf(winner)} wins the battle!`,
              "The enemy fleet is revealed on the opponent board.",
              winner !== null
            )
          : `<div class="status-banner battle-turn-status ${statusClass}" aria-live="polite">
          <span>${statusText}</span>
        </div>`}
        ${resultText ? `<div class="battle-result-chip last-result"><span>${resultText}</span></div>` : ""}
        ${errorText ? `<div class="error-text" role="alert">${errorText}</div>` : ""}
      </header>
      <div class="gameplay-screen battleship-gameplay">
        <div class="card board-panel battle-board-panel" id="render-view">
          ${boardMarkup}
        </div>
        <aside class="side-stack battle-side-stack">
          <div class="card side-card fleet-integrity-card">
            <div class="side-card-heading">
              <h2>Fleet integrity</h2>
              <strong class="num">${fleetPercent}%</strong>
            </div>
            <div class="fleet-integrity-track"><span style="width:${fleetPercent}%"></span></div>
            <p><span class="num">${intactHullCells}</span> of <span class="num">${totalHullCells}</span> hull cells intact</p>
          </div>
          <div class="card side-card salvo-card">
            <h2>Recent salvo</h2>
            ${recentSalvoMarkup(status.lastEvents ?? [])}
          </div>
          <details class="card debug-panel">
            <summary>Diagnostics</summary>
            <pre class="log-pre">${logs.slice(0, 20).join("\n") || "No events yet"}</pre>
          </details>
        </aside>
      </div>
    </section>
  `;
}
