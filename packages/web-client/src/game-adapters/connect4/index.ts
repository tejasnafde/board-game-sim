import { createElement, useSyncExternalStore } from "react";
import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameUiAdapter } from "../playable-game-ui";
import { createReactGameUiAdapter } from "../react-game-ui-adapter";
import { Connect4GameView } from "./game-view";
import { renderConnect4Lobby } from "./render";
import { inferConnect4Screen } from "./selectors";
import type { Connect4View } from "./types";

export function createConnect4UiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  return createReactGameUiAdapter({
    gameId: "connect4",
    runtime,
    renderStaticScreen(context) {
      const state = runtime.controller.getState();
      if (inferConnect4Screen(context.confirmed) === "lobby") {
        return renderConnect4Lobby(context.sessionId, context.playerId, state.lastError);
      }
      return null;
    },
    renderGameView: (context) => createElement(Connect4ControllerView, { context, runtime })
  });
}

function Connect4ControllerView(input: {
  context: Parameters<PlayableGameUiAdapter["bind"]>[0];
  runtime: WebClientRuntime;
}) {
  const state = useSyncExternalStore(
    input.runtime.controller.subscribe,
    input.runtime.controller.getState,
    input.runtime.controller.getState
  );
  const view = (state.view ?? {}) as Connect4View;
  const mySeat = state.seatId ?? input.context.playerId;
  const drop = (col: number): void => {
    if (view.phase !== "play" || view.currentPlayerId !== mySeat || state.pendingActionId) {
      input.context.pushLog("click_ignored connect4_not_your_turn");
      return;
    }
    input.runtime.controller.submitAction("drop", { col });
  };

  return createElement(Connect4GameView, {
    view,
    mySeat,
    seatNames: state.seatNames,
    lastError: state.lastError,
    pending: state.pendingActionId !== null,
    onDrop: drop,
    onRematch: input.context.rematch
  });
}

export { inferConnect4Screen } from "./selectors";
export { Connect4GameView } from "./game-view";
export { renderConnect4Lobby } from "./render";
export type { Connect4View } from "./types";
