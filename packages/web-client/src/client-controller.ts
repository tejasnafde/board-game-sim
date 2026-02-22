import type { ServerEvent, ClientEvent } from "./realtime-client";
import type { JsonValue } from "@board-game-sim/shared";
import {
  applyServerEvent,
  createActionEnvelope,
  createInitialClientState,
  type ClientState
} from "./realtime-state";
import type { ShipPlacement, Coord } from "@board-game-sim/battleship";

export interface ControllerTransport {
  send(event: ClientEvent): void;
  subscribe(listener: (event: ServerEvent) => void): () => void;
}

export type ClientController = {
  join(sessionId: string, playerId: string, gameId?: string): void;
  rejoin(): void;
  submitAction(actionType: string, payload: JsonValue): void;
  submitPlaceShips(placements: ShipPlacement[]): void;
  submitFire(target: Coord): void;
  getState(): ClientState;
};

export function createClientController(transport: ControllerTransport): ClientController {
  let state: ClientState = createInitialClientState();
  let actionCounter = 0;
  let lastGameId: string | null = null;

  transport.subscribe((event) => {
    state = applyServerEvent(state, event);
  });

  function nextActionId(): string {
    actionCounter += 1;
    return `client-action-${actionCounter}`;
  }

  /**
   * Join or create a session.
   * If gameId is provided, we attempt to CREATE the session first (server handles idempotency:
   * if it already exists, the server falls back to a join).
   * If no gameId, just join (for backward compatibility with demo sessions).
   */
  function join(sessionId: string, playerId: string, gameId?: string): void {
    state = {
      ...state,
      sessionId,
      playerId
    };
    if (gameId) {
      lastGameId = gameId;
      transport.send({ type: "session.create", sessionId, gameId, playerId });
    } else {
      transport.send({ type: "session.join", sessionId, playerId });
    }
  }

  function rejoin(): void {
    if (!state.sessionId || !state.playerId) {
      throw new Error("session_or_player_missing");
    }
    if (lastGameId) {
      transport.send({ type: "session.create", sessionId: state.sessionId, gameId: lastGameId, playerId: state.playerId });
    } else {
      transport.send({ type: "session.join", sessionId: state.sessionId, playerId: state.playerId });
    }
  }

  function submitAction(actionType: string, payload: JsonValue): void {
    const actionId = nextActionId();
    state = { ...state, pendingActionId: actionId };
    transport.send({
      type: "action.submit",
      envelope: createActionEnvelope(state, actionType, payload, actionId)
    });
  }

  function submitPlaceShips(placements: ShipPlacement[]): void {
    submitAction("place_ships", { placements });
  }

  function submitFire(target: Coord): void {
    submitAction("fire", target);
  }

  function getState(): ClientState {
    return state;
  }

  return {
    join,
    rejoin,
    submitAction,
    submitPlaceShips,
    submitFire,
    getState
  };
}
