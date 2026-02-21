import type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
import { buildCellsFromAnchor } from "./placement-utils";
import { debugPanelMarkup } from "../../templates/debug-panel";
import { lobbyPanelMarkup } from "../../templates/lobby";

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
      if (occupied.has(key)) {
        classes.push("occupied");
      }
      if (selectedCoverage.has(key)) {
        classes.push("selected-cell");
      }
      if (selectedDraft && selectedDraft.row === row && selectedDraft.col === col) {
        classes.push("selected-anchor");
      }
      cells.push(
        `<button class="${classes.join(" ")}" data-r="${row}" data-c="${col}" title="${row},${col}"></button>`
      );
    }
  }

  const shipSprites = specs
    .map((spec) => {
      const draft = draftMap[spec.id];
      if (!draft) {
        return "";
      }
      const orientation = draft.rotationDeg % 180 === 0 ? "horizontal" : "vertical";
      const widthCells = orientation === "horizontal" ? spec.size : 1;
      const heightCells = orientation === "vertical" ? spec.size : 1;
      const spriteClass = `placement-ship ${selectedShipId === spec.id ? "selected" : ""}`;
      const assetRotation = (360 - draft.rotationDeg + 90) % 360;
      return `<div class="${spriteClass}" style="--ship-row:${draft.row};--ship-col:${draft.col};--ship-width:${widthCells};--ship-height:${heightCells};--ship-rotation:${assetRotation}deg;" title="${spec.id}"><img src="${shipPreview[spec.id] ?? ""}" alt="${spec.id}" /></div>`;
    })
    .join("");

  return `
    <div class="placement-grid">${cells.join("")}</div>
    <div class="placement-ships-layer">${shipSprites}</div>
  `;
}

export function renderBattleshipLobby(sessionId: string, playerId: string): string {
  return `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Battleship</h1>
        <p>Start a session and join as a player identity.</p>
      </header>
      ${lobbyPanelMarkup(sessionId, playerId, {
        title: "Mission Lobby",
        joinLabel: "Join Mission",
        hint: "Use two windows with different player IDs to test locally."
      })}
    </section>
  `;
}

export function renderBattleshipSetup(
  definition: BattleshipDefinition,
  phase: string,
  sessionId: string,
  playerId: string,
  placementDraftMap: Record<string, PlacementDraft>,
  selectedShipId: string,
  shipPreview: Record<string, string>,
  localError: string | null,
  stateLastError: string | null | undefined
): string {
  return `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Battleship Setup</h1>
        <p>Submit all ships before battle starts. Current phase: <strong>${phase}</strong></p>
      </header>
      <div class="setup-layout">
        <aside class="card panel fleet-panel">
          <h3>Fleet Manifest</h3>
          ${definition.ships
            .map(
              (ship) => `
              <button class="fleet-row fleet-button ${selectedShipId === ship.id ? "active" : ""}" data-ship-id="${
                ship.id
              }">
                <img src="${shipPreview[ship.id] ?? ""}" alt="${ship.id}" />
                <span>${ship.id} (${ship.size})</span>
                <strong>${placementDraftMap[ship.id] ? "Placed" : "Unplaced"}</strong>
              </button>
            `
            )
            .join("")}
          <div class="fleet-actions">
            <button class="btn btn-secondary" id="load-template-btn">Load Valid Fleet</button>
            <button class="btn btn-secondary" id="random-template-btn">Randomize Fleet</button>
          </div>
        </aside>
        <section class="card panel setup-editor">
          <h3>Interactive Placement</h3>
          <p class="hint">Select ship, rotate if needed, then click starting cell.</p>
          <div class="row-actions">
            <button class="btn btn-ghost" id="rotate-btn">Rotate 90°</button>
            <button class="btn btn-ghost" id="clear-ship-btn">Clear Selected</button>
          </div>
          <div class="placement-board" id="placement-board">
            ${renderPlacementBoardMarkup(definition, definition.ships as ShipSpec[], placementDraftMap, selectedShipId, shipPreview)}
          </div>
          <div class="row-actions">
            <button class="btn btn-primary" id="submit-setup-btn">Submit Setup</button>
            <button class="btn btn-secondary" id="rejoin-btn">Rejoin</button>
          </div>
          <p class="status">Last error: <strong>${localError ?? stateLastError ?? "none"}</strong></p>
        </section>
      </div>
    </section>
  `;
}

export function renderBattleshipGameplay(
  phase: string,
  view: ClientView,
  canFire: boolean,
  boardMarkup: string,
  logs: string[],
  stateDump: string
): string {
  return `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Live Battle</h1>
        <p>
          Phase: <strong>${phase}</strong> · Turn: <strong>${view.currentPlayerId ?? "-"}</strong>
          ${view.winnerPlayerId ? `· Winner: <strong>${view.winnerPlayerId}</strong>` : ""}
        </p>
        <p>${canFire ? "Your turn: click a cell on Opponent Board." : "Waiting for opponent turn or setup completion."}</p>
      </header>
      <div class="gameplay-screen">
        <div class="card panel board-panel" id="render-view">${boardMarkup}</div>
        ${debugPanelMarkup(logs, stateDump)}
      </div>
    </section>
  `;
}
