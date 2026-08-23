import { createElement, useSyncExternalStore } from "react";
import type { SignalChannel, SignalRank } from "@board-game-sim/signal-crew";
import type { WebClientRuntime } from "../../runtime";
import type { PlayableGameBindContext, PlayableGameUiAdapter } from "../playable-game-ui";
import { createReactGameUiAdapter } from "../react-game-ui-adapter";
import { SignalCrewGameView } from "./game-view";
import { renderSignalCrewLobby } from "./render";
import { inferSignalCrewScreen } from "./selectors";
import type { SignalCrewView } from "./types";

export function createSignalCrewUiAdapter(runtime: WebClientRuntime): PlayableGameUiAdapter {
  return createReactGameUiAdapter({
    gameId: "signal-crew",
    runtime,
    renderStaticScreen(context) {
      const state = runtime.controller.getState();
      return inferSignalCrewScreen(context.confirmed) === "lobby"
        ? renderSignalCrewLobby(context.sessionId, context.playerId, state.lastError)
        : null;
    },
    renderGameView: (context) => createElement(SignalCrewControllerView, { context, runtime })
  });
}

function SignalCrewControllerView(input: {
  context: PlayableGameBindContext;
  runtime: WebClientRuntime;
}) {
  const state = useSyncExternalStore(
    input.runtime.controller.subscribe,
    input.runtime.controller.getState,
    input.runtime.controller.getState
  );
  const view = (state.view ?? {}) as SignalCrewView;
  const mySeat = state.seatId ?? input.context.playerId;
  const blocked = state.pendingActionId !== null || state.table?.ready === false || !view.canAct;
  const submit = (actionType: string, payload: Record<string, string | number>) => {
    if (!blocked) input.runtime.controller.submitAction(actionType, payload);
  };
  return createElement(SignalCrewGameView, {
    view,
    table: state.table,
    mySeat,
    seatNames: state.seatNames,
    acceptedActions: state.acceptedActions,
    pending: state.pendingActionId !== null,
    lastError: state.lastError,
    onGiveClue: (targetPlayerId: string, attribute: "channel" | "rank", value: SignalChannel | SignalRank) => (
      submit("give_clue", { targetPlayerId, attribute, value })
    ),
    onTransmit: (packetId: string, socketId: string) => submit("transmit_packet", { packetId, socketId }),
    onRecycle: (packetId: string) => submit("recycle_packet", { packetId }),
    onStandBy: () => submit("stand_by", {}),
    onRematch: input.context.rematch
  });
}

export { SignalCrewGameView } from "./game-view";
export { inferSignalCrewScreen } from "./selectors";
export { renderSignalCrewLobby } from "./render";
