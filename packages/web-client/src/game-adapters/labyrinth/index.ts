import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameUiAdapter } from "../playable-game-ui";
import { bindLabyrinthEvents } from "./bind-events";
import {
  createLabyrinthPresentationState,
  renderLabyrinthGameplay,
  renderLabyrinthLobby
} from "./render";
import { inferLabyrinthScreen } from "./selectors";
import type { LabyrinthView } from "./types";

export function createLabyrinthUiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  let presentation = createLabyrinthPresentationState();

  return {
    gameId: "labyrinth",
    runtime,
    resetSession() {
      presentation = createLabyrinthPresentationState();
    },
    render(context) {
      const state = runtime.controller.getState();
      const view = (state.view ?? {}) as LabyrinthView;
      if (inferLabyrinthScreen(context.confirmed) === "lobby") {
        return renderLabyrinthLobby(context.sessionId, context.playerId, state.lastError);
      }
      return renderLabyrinthGameplay(
        view,
        state.seatId ?? context.playerId,
        context.logs,
        JSON.stringify(state, null, 2),
        { seatNames: state.seatNames, lastError: state.lastError, lastEvents: state.lastEvents },
        presentation
      );
    },
    bind(context) {
      bindLabyrinthEvents(context.root, {
        runtime,
        playerId: context.playerId,
        render: context.render,
        pushLog: context.pushLog
      });
    }
  };
}

export { inferLabyrinthScreen } from "./selectors";
export { createLabyrinthPresentationState, renderLabyrinthLobby, renderLabyrinthGameplay } from "./render";
export { bindLabyrinthEvents, type LabyrinthBindContext } from "./bind-events";
export type { LabyrinthView } from "./types";
