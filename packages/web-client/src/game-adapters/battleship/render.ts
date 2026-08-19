import { icon } from "../../icons";
import { lobbyPanelMarkup } from "../../templates/lobby";
import { buildCellsFromAnchor } from "./placement-utils";
import type { BattleshipDefinition, PlacementDraft, ShipSpec } from "./types";

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

  const shipSprites = specs.map((spec) => {
    const draft = draftMap[spec.id];
    if (!draft) return "";
    const shipCells = buildCellsFromAnchor(draft, spec.size);
    const rows = shipCells.map((cell) => cell.row);
    const cols = shipCells.map((cell) => cell.col);
    const startRow = Math.min(...rows);
    const startCol = Math.min(...cols);
    const horizontal = draft.rotationDeg % 180 === 0;
    const widthCells = Math.max(...cols) - startCol + 1;
    const heightCells = Math.max(...rows) - startRow + 1;
    const preview = normalizeShipPreview(shipPreview[spec.id]);
    const artRotation = (draft.rotationDeg - facingAngle(preview.nativeFacing) + 360) % 360;
    const nativeAxis = preview.nativeFacing === "east" || preview.nativeFacing === "west"
      ? "native-horizontal"
      : "native-vertical";
    const selected = selectedShipId === spec.id;

    return `<div
      class="placement-ship ${horizontal ? "is-horizontal" : "is-vertical"} ${nativeAxis} ${selected ? "selected" : ""}"
      data-ship-id="${spec.id}"
      style="--ship-row:${startRow};--ship-col:${startCol};--ship-width:${widthCells};--ship-height:${heightCells};--ship-size:${spec.size};--ship-art-rotation:${artRotation}deg;"
      title="${spec.id} - click to select, right-click board to rotate"
    >
      <img class="placement-ship-art" src="${preview.url}" alt="" />
      <span class="placement-ship-label">${spec.id}</span>
      ${selected ? '<div class="ship-selected-ring"></div>' : ""}
    </div>`;
  }).join("");

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
