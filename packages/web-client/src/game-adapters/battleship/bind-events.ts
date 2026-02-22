import type { ShipPlacement } from "@board-game-sim/battleship";
import { createDefaultPlacementsFromDefinition } from "../../battleship-template";
import type { WebClientRuntime } from "../../runtime";
import type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
import {
  buildCellsFromAnchor,
  canPlaceWithoutCollision,
  clampDraftToBoard,
  createPlacementsFromDrafts,
  createRandomizedPlacements,
  isInBounds,
  placementsToDraftMap,
  rotateClockwise
} from "./placement-utils";

export type BattleshipBindContext = {
  runtime: WebClientRuntime;
  definition: BattleshipDefinition;
  shipSpecs: ShipSpec[];
  placementDraftMap: Record<string, PlacementDraft>;
  selectedShipId: string;
  localError: string | null;
  playerId: string;
  render: () => void;
  pushLog: (entry: string) => void;
  setPlacementDraftMap: (map: Record<string, PlacementDraft>) => void;
  setSelectedShipId: (id: string) => void;
  setLocalError: (err: string | null) => void;
};

export function bindBattleshipEvents(root: HTMLElement, ctx: BattleshipBindContext): void {
  const loadTemplateBtn = root.querySelector<HTMLButtonElement>("#load-template-btn");
  const randomTemplateBtn = root.querySelector<HTMLButtonElement>("#random-template-btn");
  const rotateBtn = root.querySelector<HTMLButtonElement>("#rotate-btn");
  const clearShipBtn = root.querySelector<HTMLButtonElement>("#clear-ship-btn");
  const submitSetupBtn = root.querySelector<HTMLButtonElement>("#submit-setup-btn");
  const rejoinBtn = root.querySelector<HTMLButtonElement>("#rejoin-btn");
  const renderView = root.querySelector<HTMLElement>("#render-view");
  const placementBoard = root.querySelector<HTMLElement>("#placement-board");
  const fleetPanel = root.querySelector<HTMLElement>(".fleet-panel");

  loadTemplateBtn?.addEventListener("click", () => {
    ctx.setPlacementDraftMap(
      placementsToDraftMap(createDefaultPlacementsFromDefinition(ctx.definition))
    );
    ctx.render();
  });

  randomTemplateBtn?.addEventListener("click", () => {
    ctx.setPlacementDraftMap(placementsToDraftMap(createRandomizedPlacements(ctx.definition)));
    ctx.render();
  });

  const applyRotation = (): void => {
    const active = ctx.placementDraftMap[ctx.selectedShipId] ?? { row: 0, col: 0, rotationDeg: 0 as const };
    const spec = ctx.shipSpecs.find((ship) => ship.id === ctx.selectedShipId);
    if (!spec) return;
    const rotated: PlacementDraft = {
      ...active,
      rotationDeg: rotateClockwise(active.rotationDeg)
    };
    const normalizedRotated = clampDraftToBoard(rotated, spec.size, ctx.definition);
    const candidateCells = buildCellsFromAnchor(normalizedRotated, spec.size);
    if (!isInBounds(candidateCells, ctx.definition)) {
      ctx.setLocalError("rotation_out_of_bounds");
    } else if (
      !canPlaceWithoutCollision(
        ctx.shipSpecs,
        ctx.placementDraftMap,
        ctx.selectedShipId,
        candidateCells
      )
    ) {
      ctx.setLocalError("rotation_collision");
    } else {
      ctx.setPlacementDraftMap({
        ...ctx.placementDraftMap,
        [ctx.selectedShipId]: normalizedRotated
      });
      ctx.setLocalError(null);
    }
    ctx.render();
  };

  rotateBtn?.addEventListener("click", () => applyRotation());

  clearShipBtn?.addEventListener("click", () => {
    const { [ctx.selectedShipId]: _ignored, ...rest } = ctx.placementDraftMap;
    ctx.setPlacementDraftMap(rest);
    ctx.setLocalError(null);
    ctx.render();
  });

  // Click ship in fleet list → select it
  fleetPanel?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const shipButton = target.closest<HTMLElement>("[data-ship-id]");
    if (!shipButton) return;
    ctx.setSelectedShipId(shipButton.dataset.shipId ?? ctx.selectedShipId);
    ctx.render();
  });

  // Handle clicks on the placement board — both on cells and on ship sprites
  placementBoard?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    // Clicking directly on a placed ship sprite → select that ship
    const shipSprite = target.closest<HTMLElement>(".placement-ship");
    if (shipSprite) {
      const shipId = shipSprite.dataset.shipId;
      if (shipId) {
        ctx.setSelectedShipId(shipId);
        ctx.setLocalError(null);
        ctx.render();
        return;
      }
    }

    // Otherwise clicking a grid cell → place the selected ship there
    const cell = target.closest<HTMLElement>(".placement-cell");
    if (!cell) return;
    const row = Number(cell.dataset.r ?? "-1");
    const col = Number(cell.dataset.c ?? "-1");
    if (row < 0 || col < 0) return;

    const ship = ctx.shipSpecs.find((spec) => spec.id === ctx.selectedShipId);
    if (!ship) return;
    const currentRotation = ctx.placementDraftMap[ctx.selectedShipId]?.rotationDeg ?? 0;
    const candidateDraft: PlacementDraft = { row, col, rotationDeg: currentRotation };
    const candidateCells = buildCellsFromAnchor(candidateDraft, ship.size);
    if (!isInBounds(candidateCells, ctx.definition)) {
      ctx.setLocalError("ship_out_of_bounds");
    } else if (
      !canPlaceWithoutCollision(
        ctx.shipSpecs,
        ctx.placementDraftMap,
        ctx.selectedShipId,
        candidateCells
      )
    ) {
      ctx.setLocalError("ship_overlap_collision");
    } else {
      ctx.setPlacementDraftMap({
        ...ctx.placementDraftMap,
        [ctx.selectedShipId]: candidateDraft
      });
      ctx.setLocalError(null);

      // Auto-advance to next unplaced ship
      const nextUnplaced = ctx.shipSpecs.find(
        (s) => s.id !== ctx.selectedShipId && !({
          ...ctx.placementDraftMap,
          [ctx.selectedShipId]: candidateDraft
        })[s.id]
      );
      if (nextUnplaced) {
        ctx.setSelectedShipId(nextUnplaced.id);
      }
    }
    ctx.render();
  });

  // Right-click on placement board → rotate selected ship
  placementBoard?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    applyRotation();
  });

  submitSetupBtn?.addEventListener("click", () => {
    try {
      ctx.runtime.controller.submitPlaceShips(
        createPlacementsFromDrafts(ctx.shipSpecs, ctx.placementDraftMap, ctx.definition)
      );
      ctx.setLocalError(null);
    } catch {
      ctx.setLocalError("setup_incomplete_or_invalid");
    }
    ctx.render();
  });

  rejoinBtn?.addEventListener("click", () => {
    ctx.runtime.rejoin();
    ctx.render();
  });

  renderView?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const opponentCell = target.closest<HTMLElement>(".opponent-cell");
    if (!opponentCell) return;

    const stateForAction = ctx.runtime.controller.getState();
    const latestView = (stateForAction.view ?? {}) as ClientView;
    const latestPhase = latestView.phase ?? "setup";
    const canFire = latestPhase === "play" && latestView.currentPlayerId === ctx.playerId;
    if (!canFire) {
      ctx.pushLog(
        `click_ignored not_your_turn_or_not_play phase=${latestPhase} current=${latestView.currentPlayerId ?? "-"}`
      );
      return;
    }

    const row = Number(opponentCell.dataset.r ?? "-1");
    const col = Number(opponentCell.dataset.c ?? "-1");
    if (row >= 0 && col >= 0) {
      ctx.pushLog(`click_fire row=${row} col=${col}`);
      ctx.runtime.controller.submitFire({ row, col });
      ctx.render();
    }
  });
}
