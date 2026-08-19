import { createElement, useSyncExternalStore } from "react";
import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameBindContext, PlayableGameUiAdapter } from "../playable-game-ui";
import { createReactGameUiAdapter } from "../react-game-ui-adapter";
import { LabyrinthGameView } from "./game-view";
import { renderLabyrinthLobby } from "./render";
import { inferLabyrinthScreen } from "./selectors";
import type { LabyrinthView } from "./types";

export function createLabyrinthUiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  return createReactGameUiAdapter({
    gameId: "labyrinth",
    runtime,
    renderStaticScreen(context) {
      const state = runtime.controller.getState();
      if (inferLabyrinthScreen(context.confirmed) === "lobby") {
        return renderLabyrinthLobby(context.sessionId, context.playerId, state.lastError);
      }
      return null;
    },
    renderGameView: (context) => createElement(LabyrinthControllerView, { context, runtime })
  });
}

function LabyrinthControllerView(input: {
  context: PlayableGameBindContext;
  runtime: WebClientRuntime;
}) {
  const state = useSyncExternalStore(
    input.runtime.controller.subscribe,
    input.runtime.controller.getState,
    input.runtime.controller.getState
  );
  const view = (state.view ?? {}) as LabyrinthView;
  const mySeat = state.seatId ?? input.context.playerId;
  const rotate = (rotationDeg: 0 | 90 | 180 | 270): void => {
    if (view.phase !== "play" || view.currentPlayerId !== mySeat || view.turnStage !== "insert" || state.pendingActionId) {
      input.context.pushLog("click_ignored labyrinth_rotate_not_allowed");
      return;
    }
    input.runtime.controller.submitAction("rotate_spare", { rotationDeg });
  };
  const insert = (edge: "top" | "bottom" | "left" | "right", index: number): void => {
    if (view.phase !== "play" || view.currentPlayerId !== mySeat || view.turnStage !== "insert" || state.pendingActionId) {
      input.context.pushLog("click_ignored labyrinth_insert_not_allowed");
      return;
    }
    input.runtime.controller.submitAction("insert_tile", { edge, index });
  };
  const move = (row: number, col: number): void => {
    if (view.phase !== "play" || view.currentPlayerId !== mySeat || view.turnStage !== "move" || state.pendingActionId) {
      input.context.pushLog("click_ignored labyrinth_move_not_allowed");
      return;
    }
    input.runtime.controller.submitAction("move_pawn", { row, col });
  };

  return createElement(LabyrinthGameView, {
    view,
    mySeat,
    seatNames: state.seatNames,
    lastError: state.lastError,
    acceptedActions: state.acceptedActions,
    logs: input.context.logs,
    pending: state.pendingActionId !== null,
    onRotate: rotate,
    onInsert: insert,
    onMove: move,
    onRematch: input.context.rematch
  });
}

export { inferLabyrinthScreen } from "./selectors";
export { LabyrinthGameView } from "./game-view";
export { renderLabyrinthLobby } from "./render";
export type { LabyrinthView } from "./types";
