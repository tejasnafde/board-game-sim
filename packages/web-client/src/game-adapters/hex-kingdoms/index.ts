import { createElement, useEffect, useState, useSyncExternalStore } from "react";
import type { AxialCoord } from "@board-game-sim/shared";
import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameBindContext, PlayableGameUiAdapter } from "../playable-game-ui";
import { createReactGameUiAdapter } from "../react-game-ui-adapter";
import { HexKingdomsGameView } from "./game-view";
import { renderHexKingdomsLobby } from "./render";
import { inferHexKingdomsScreen } from "./selectors";
import type { HexKingdomsView } from "./types";

export function createHexKingdomsUiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  return createReactGameUiAdapter({
    gameId: "hex-kingdoms",
    runtime,
    renderStaticScreen(context) {
      const state = runtime.controller.getState();
      return inferHexKingdomsScreen(context.confirmed) === "lobby"
        ? renderHexKingdomsLobby(context.sessionId, context.playerId, state.lastError)
        : null;
    },
    renderGameView: (context) => createElement(HexKingdomsControllerView, { context, runtime })
  });
}

function HexKingdomsControllerView(input: {
  context: PlayableGameBindContext;
  runtime: WebClientRuntime;
}) {
  const state = useSyncExternalStore(
    input.runtime.controller.subscribe,
    input.runtime.controller.getState,
    input.runtime.controller.getState
  );
  const view = (state.view ?? {}) as HexKingdomsView;
  const mySeat = state.seatId ?? input.context.playerId;
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedTileId && !view.market?.some((tile) => tile.id === selectedTileId)) {
      setSelectedTileId(null);
    }
  }, [selectedTileId, view.market]);

  const selectTile = (tileId: string): void => {
    if (view.phase !== "play" || !view.canAct || state.pendingActionId || state.table?.ready === false) return;
    setSelectedTileId((current) => current === tileId ? null : tileId);
  };
  const place = (tileId: string, coordinate: AxialCoord): void => {
    if (view.phase !== "play" || !view.canAct || state.pendingActionId || state.table?.ready === false) return;
    input.runtime.controller.submitAction("draft_and_place", {
      marketTileId: tileId,
      q: coordinate.q,
      r: coordinate.r
    });
  };

  return createElement(HexKingdomsGameView, {
    view,
    table: state.table,
    mySeat,
    seatNames: state.seatNames,
    selectedTileId,
    pending: state.pendingActionId !== null,
    onSelectTile: selectTile,
    onPlace: place,
    onRematch: input.context.rematch
  });
}

export { HexKingdomsGameView } from "./game-view";
export { inferHexKingdomsScreen } from "./selectors";
export { renderHexKingdomsLobby } from "./render";
