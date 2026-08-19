import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameUiAdapter } from "../playable-game-ui";
import { bindConnect4Events } from "./bind-events";
import { renderConnect4Gameplay, renderConnect4Lobby } from "./render";
import { inferConnect4Screen } from "./selectors";
import type { Connect4View } from "./types";

export function createConnect4UiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  return {
    gameId: "connect4",
    runtime,
    resetSession() {},
    render(context) {
      const state = runtime.controller.getState();
      const view = (state.view ?? {}) as Connect4View;
      if (inferConnect4Screen(context.confirmed) === "lobby") {
        return renderConnect4Lobby(context.sessionId, context.playerId, state.lastError);
      }
      return renderConnect4Gameplay(view, state.seatId ?? context.playerId, {
        seatNames: state.seatNames,
        lastError: state.lastError
      });
    },
    bind(context) {
      bindConnect4Events(context.root, {
        runtime,
        playerId: context.playerId,
        render: context.render,
        pushLog: context.pushLog
      });
    }
  };
}

export { inferConnect4Screen } from "./selectors";
export { renderConnect4Lobby, renderConnect4Gameplay } from "./render";
export { bindConnect4Events, type Connect4BindContext } from "./bind-events";
export type { Connect4View } from "./types";
