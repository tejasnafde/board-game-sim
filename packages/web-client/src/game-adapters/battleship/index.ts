import { battleshipManifest } from "../../game-manifests";
import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameUiAdapter } from "../playable-game-ui";
import { bindBattleshipEvents } from "./bind-events";
import { placementsToDraftMap } from "./placement-utils";
import {
  renderBattleshipGameplay,
  renderBattleshipLobby,
  renderBattleshipSetup
} from "./render";
import { inferBattleshipScreen } from "./selectors";
import type { BattleshipDefinition, ClientView, PlacementDraft } from "./types";

export function createBattleshipUiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  const definition = battleshipManifest.definition as BattleshipDefinition;
  const shipSpecs = definition.ships;
  const shipPreview = Object.fromEntries(
    shipSpecs.map((ship) => [ship.id, runtime.assetManager.resolveAssetUrl(`ship-${ship.id}`)])
  );
  let placementDraftMap: Record<string, PlacementDraft> = {};
  let selectedShipId = shipSpecs[0]?.id ?? "";
  let localError: string | null = null;

  const resetSession = (): void => {
    placementDraftMap = {};
    selectedShipId = shipSpecs[0]?.id ?? "";
    localError = null;
  };

  return {
    gameId: "battleship",
    runtime,
    resetSession,
    render(context) {
      const state = runtime.controller.getState();
      const view = (state.view ?? {}) as ClientView;
      const phase = view.phase ?? "setup";
      const mySeat = state.seatId ?? context.playerId;
      const screen = inferBattleshipScreen(context.confirmed, view);
      if (screen === "lobby") {
        return renderBattleshipLobby(context.sessionId, context.playerId, state.lastError);
      }
      if (screen === "setup") {
        return renderBattleshipSetup(
          definition,
          (view.ownBoard?.ships?.length ?? 0) > 0,
          context.sessionId,
          context.playerId,
          placementDraftMap,
          selectedShipId,
          shipPreview,
          localError,
          state.lastError
        );
      }
      return renderBattleshipGameplay(
        phase,
        view,
        phase === "play" && view.currentPlayerId === mySeat,
        runtime.renderer.render(view),
        context.logs,
        JSON.stringify(state, null, 2),
        {
          seatNames: state.seatNames,
          lastError: state.lastError,
          lastEvents: state.lastEvents,
          mySeat
        }
      );
    },
    bind(context) {
      bindBattleshipEvents(context.root, {
        runtime,
        definition,
        shipSpecs,
        placementDraftMap,
        selectedShipId,
        localError,
        playerId: context.playerId,
        render: context.render,
        pushLog: context.pushLog,
        setPlacementDraftMap: (map) => {
          placementDraftMap = map;
        },
        setSelectedShipId: (id) => {
          selectedShipId = id;
        },
        setLocalError: (error) => {
          localError = error;
        }
      });
    }
  };
}

export { inferBattleshipScreen } from "./selectors";
export {
  renderBattleshipLobby,
  renderBattleshipSetup,
  renderBattleshipGameplay,
  renderPlacementBoardMarkup
} from "./render";
export { bindBattleshipEvents, type BattleshipBindContext } from "./bind-events";
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
