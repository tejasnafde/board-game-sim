import type { ServerEvent, ClientEvent } from "./realtime-client";
import { createLogger, type JsonValue } from "@board-game-sim/shared";
import {
  applyServerEvent,
  createActionEnvelope,
  createInitialClientState,
  type ClientState
} from "./realtime-state";
import type { ShipPlacement, Coord } from "@board-game-sim/battleship";

const log = createLogger("controller");

export interface ControllerTransport {
  send(event: ClientEvent): void;
  subscribe(listener: (event: ServerEvent) => void): () => void;
}

export type ClientController = {
  join(sessionId: string, playerId: string, gameId?: string, seatCount?: number, bots?: number): void;
  rejoin(): void;
  submitAction(actionType: string, payload: JsonValue): void;
  submitPlaceShips(placements: ShipPlacement[]): void;
  submitFire(target: Coord): void;
  getState(): ClientState;
  subscribe(listener: () => void): () => void;
};

export function createClientController(transport: ControllerTransport): ClientController {
  let state: ClientState = createInitialClientState();
  let actionCounter = 0;
  let lastGameId: string | null = null;
  let lastSeatCount: number | undefined;
  let lastBots: number | undefined;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  transport.subscribe((event) => {
    state = applyServerEvent(state, event);
    notify();
  });

  function nextActionId(): string {
    actionCounter += 1;
    return `client-action-${actionCounter}`;
  }

  /**
   * Join or create a session.
   * If gameId is provided, we attempt to CREATE the session first (server handles idempotency:
   * if it already exists, the server falls back to a join).
   * If no gameId, just join - a typo'd code surfaces session_not_found instead of
   * silently creating a private empty game.
   */
  function join(sessionId: string, playerId: string, gameId?: string, seatCount?: number, bots?: number): void {
    // Reset per-session evidence: the game screen only shows again once the
    // server confirms this join with a state_sync.
    state = {
      ...state,
      sessionId,
      playerId,
      seatId: null,
      synced: false,
      view: null,
      terminal: null,
      lastError: null,
      lastEvents: [],
      acceptedActions: []
    };
    notify();
    if (gameId) {
      lastGameId = gameId;
      lastSeatCount = seatCount;
      lastBots = bots;
      log.info(`create ${sessionId} (${gameId}) as "${playerId}" seats=${seatCount ?? "default"} bots=${bots ?? 0}`);
      transport.send({ type: "session.create", sessionId, gameId, playerId, seatCount, bots });
    } else {
      lastGameId = null;
      log.info(`join ${sessionId} as "${playerId}"`);
      transport.send({ type: "session.join", sessionId, playerId });
    }
  }

  function rejoin(): void {
    if (!state.sessionId || !state.playerId) {
      throw new Error("session_or_player_missing");
    }
    if (lastGameId) {
      transport.send({ type: "session.create", sessionId: state.sessionId, gameId: lastGameId, playerId: state.playerId, seatCount: lastSeatCount, bots: lastBots });
    } else {
      transport.send({ type: "session.join", sessionId: state.sessionId, playerId: state.playerId });
    }
  }

  function submitAction(actionType: string, payload: JsonValue): void {
    log.debug(`submit ${actionType}`, payload);
    const actionId = nextActionId();
    state = { ...state, pendingActionId: actionId };
    notify();
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

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    join,
    rejoin,
    submitAction,
    submitPlaceShips,
    submitFire,
    getState,
    subscribe
  };
}
