import { createElement, useState, useSyncExternalStore } from "react";
import { battleshipManifest } from "../../game-manifests";
import type { RenderedWebClientRuntime } from "../../runtime";
import type { PlayableGameBindContext, PlayableGameUiAdapter } from "../playable-game-ui";
import { createReactGameUiAdapter } from "../react-game-ui-adapter";
import { BattleshipGameView, BattleshipSetupView } from "./game-view";
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
import { createDefaultPlacementsFromDefinition } from "../../battleship-template";
import {
  renderBattleshipLobby
} from "./render";
import { inferBattleshipScreen } from "./selectors";
import type { BattleshipDefinition, ClientView, PlacementDraft } from "./types";

export function createBattleshipUiAdapter(runtime: RenderedWebClientRuntime): PlayableGameUiAdapter {
  const definition = battleshipManifest.definition as BattleshipDefinition;
  const shipSpecs = definition.ships;
  const shipPreview = Object.fromEntries(
    shipSpecs.map((ship) => {
      const asset = runtime.assets?.resolve(`piece.${ship.id}`);
      return [
        ship.id,
        asset
          ? { url: asset.url, nativeFacing: asset.nativeFacing }
          : runtime.assetManager.resolveAssetUrl(`ship-${ship.id}`)
      ];
    })
  );
  return createReactGameUiAdapter({
    gameId: "battleship",
    runtime,
    renderStaticScreen(context) {
      const state = runtime.controller.getState();
      const view = (state.view ?? {}) as ClientView;
      const screen = inferBattleshipScreen(context.confirmed, view);
      if (screen === "lobby") {
        return renderBattleshipLobby(context.sessionId, context.playerId, state.lastError);
      }
      return null;
    },
    renderGameView: (context) => createElement(BattleshipControllerView, {
      context,
      definition,
      runtime,
      shipPreview
    })
  });
}

function BattleshipControllerView(input: {
  context: PlayableGameBindContext;
  definition: BattleshipDefinition;
  runtime: RenderedWebClientRuntime;
  shipPreview: Parameters<typeof BattleshipSetupView>[0]["shipPreview"];
}) {
  const state = useSyncExternalStore(
    input.runtime.controller.subscribe,
    input.runtime.controller.getState,
    input.runtime.controller.getState
  );
  const view = (state.view ?? {}) as ClientView;
  const mySeat = state.seatId ?? input.context.playerId;
  const shipSpecs = input.definition.ships;
  const [placementDraftMap, setPlacementDraftMap] = useState<Record<string, PlacementDraft>>({});
  const [selectedShipId, setSelectedShipId] = useState(shipSpecs[0]?.id ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  if ((view.phase ?? "setup") === "setup") {
    const rotate = (): void => {
      const active = placementDraftMap[selectedShipId] ?? { row: 0, col: 0, rotationDeg: 0 as const };
      const spec = shipSpecs.find((ship) => ship.id === selectedShipId);
      if (!spec) return;
      const rotated = clampDraftToBoard(
        { ...active, rotationDeg: rotateClockwise(active.rotationDeg) },
        spec.size,
        input.definition
      );
      const candidateCells = buildCellsFromAnchor(rotated, spec.size);
      if (!isInBounds(candidateCells, input.definition)) {
        setLocalError("rotation_out_of_bounds");
        return;
      }
      if (!canPlaceWithoutCollision(shipSpecs, placementDraftMap, selectedShipId, candidateCells)) {
        setLocalError("rotation_collision");
        return;
      }
      setPlacementDraftMap({ ...placementDraftMap, [selectedShipId]: rotated });
      setLocalError(null);
    };
    const place = (row: number, col: number): void => {
      const ship = shipSpecs.find((spec) => spec.id === selectedShipId);
      if (!ship) return;
      const candidate: PlacementDraft = {
        row,
        col,
        rotationDeg: placementDraftMap[selectedShipId]?.rotationDeg ?? 0
      };
      const cells = buildCellsFromAnchor(candidate, ship.size);
      if (!isInBounds(cells, input.definition)) {
        setLocalError("ship_out_of_bounds");
        return;
      }
      if (!canPlaceWithoutCollision(shipSpecs, placementDraftMap, selectedShipId, cells)) {
        setLocalError("ship_overlap_collision");
        return;
      }
      const nextDrafts = { ...placementDraftMap, [selectedShipId]: candidate };
      setPlacementDraftMap(nextDrafts);
      setLocalError(null);
      const nextShip = shipSpecs.find((spec) => spec.id !== selectedShipId && !nextDrafts[spec.id]);
      if (nextShip) setSelectedShipId(nextShip.id);
    };
    const submit = (): void => {
      try {
        input.runtime.controller.submitPlaceShips(
          createPlacementsFromDrafts(shipSpecs, placementDraftMap, input.definition)
        );
        setLocalError(null);
      } catch {
        setLocalError("setup_incomplete_or_invalid");
      }
    };

    return createElement(BattleshipSetupView, {
      definition: input.definition,
      shipPreview: input.shipPreview,
      placementDraftMap,
      selectedShipId,
      waiting: (view.ownBoard?.ships?.length ?? 0) > 0,
      error: localError ?? state.lastError,
      onLoadTemplate: () => setPlacementDraftMap(
        placementsToDraftMap(createDefaultPlacementsFromDefinition(input.definition))
      ),
      onRandomize: () => setPlacementDraftMap(
        placementsToDraftMap(createRandomizedPlacements(input.definition))
      ),
      onRotate: rotate,
      onClear: () => {
        const next = { ...placementDraftMap };
        delete next[selectedShipId];
        setPlacementDraftMap(next);
        setLocalError(null);
      },
      onSelectShip: (shipId) => {
        setSelectedShipId(shipId);
        setLocalError(null);
      },
      onPlace: place,
      onSubmit: submit,
      onRejoin: input.runtime.rejoin
    });
  }
  const fire = (row: number, col: number): void => {
    if (view.phase !== "play" || view.currentPlayerId !== mySeat || state.pendingActionId) {
      input.context.pushLog(
        `click_ignored not_your_turn_or_not_play phase=${view.phase ?? "setup"} current=${view.currentPlayerId ?? "-"}`
      );
      return;
    }
    input.context.pushLog(`click_fire row=${row} col=${col}`);
    input.runtime.controller.submitFire({ row, col });
  };

  return createElement(BattleshipGameView, {
    view,
    mySeat,
    seatNames: state.seatNames,
    lastError: state.lastError,
    acceptedActions: state.acceptedActions,
    logs: input.context.logs,
    boardMarkup: input.runtime.renderer.render(view),
    pending: state.pendingActionId !== null,
    onFire: fire,
    onRematch: input.context.rematch
  });
}

export { inferBattleshipScreen } from "./selectors";
export {
  renderBattleshipLobby,
  renderPlacementBoardMarkup
} from "./render";
export { BattleshipGameView, BattleshipSetupView } from "./game-view";
export {
  buildCellsFromAnchor,
  canPlaceWithoutCollision,
  clampDraftToBoard,
  createPlacementsFromDrafts,
  createRandomizedPlacements,
  isInBounds,
  placementsToDraftMap,
  rotateClockwise
} from "./placement-utils";
export type { BattleshipDefinition, ClientView, PlacementDraft, ShipSpec } from "./types";
