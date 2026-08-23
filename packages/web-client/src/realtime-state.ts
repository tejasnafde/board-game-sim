import type { EngineActionEnvelope, JsonValue, TableSummary } from "@board-game-sim/shared";
import type { ServerEvent } from "./realtime-client";
export type { ServerEvent } from "./realtime-client";

export type AcceptedAction = {
  seq: number;
  actorPlayerId: string | null;
  events: JsonValue[];
};

export type ClientState = {
  sessionId: string | null;
  playerId: string | null;
  /** Engine seat id ("player-1"…) assigned by the server for this player's name. */
  seatId: string | null;
  /** seatId → display name, from the latest state_sync. */
  seatNames: Record<string, string>;
  table: TableSummary | null;
  /** True once a state_sync for the current sessionId has arrived (join confirmed). */
  synced: boolean;
  seq: number;
  view: JsonValue | null;
  pendingActionId: string | null;
  lastError: string | null;
  /** Domain events from the most recent action_accepted (hit/miss/sunk feedback). */
  lastEvents: JsonValue[];
  acceptedActions: AcceptedAction[];
  terminal: { winnerPlayerId: string | null; reason: string } | null;
};

export function createInitialClientState(): ClientState {
  return {
    sessionId: null,
    playerId: null,
    seatId: null,
    seatNames: {},
    table: null,
    synced: false,
    seq: 0,
    view: null,
    pendingActionId: null,
    lastError: null,
    lastEvents: [],
    acceptedActions: [],
    terminal: null
  };
}

function eventTargetsSession(state: ClientState, event: ServerEvent): boolean {
  if (!state.sessionId) {
    return true;
  }
  return event.sessionId === state.sessionId;
}

export function applyServerEvent(state: ClientState, event: ServerEvent): ClientState {
  if (!eventTargetsSession(state, event)) {
    return state;
  }

  if (event.type === "session.created") {
    // Session was created on demand; a state_sync will follow with the actual seq.
    return {
      ...state,
      sessionId: event.sessionId,
      lastError: null
    };
  }

  if (event.type === "session.state_sync") {
    return {
      ...state,
      sessionId: event.sessionId,
      seatId: event.youAre ?? state.seatId,
      seatNames: event.seats ?? state.seatNames,
      table: event.table ?? state.table,
      synced: true,
      seq: event.seq,
      view: event.view,
      lastError: null
    };
  }

  if (event.type === "session.action_accepted") {
    const acceptedAction: AcceptedAction = {
      seq: event.seq,
      actorPlayerId: event.actorPlayerId ?? null,
      events: event.events
    };
    return {
      ...state,
      seq: event.seq,
      pendingActionId: null,
      lastError: null,
      lastEvents: event.events,
      acceptedActions: [...state.acceptedActions, acceptedAction].slice(-20)
    };
  }

  if (event.type === "session.action_rejected") {
    return {
      ...state,
      pendingActionId: null,
      lastError: event.reason
    };
  }

  return {
    ...state,
    terminal: {
      winnerPlayerId: event.winnerPlayerId,
      reason: event.reason
    }
  };
}

export function createActionEnvelope(
  state: ClientState,
  actionType: string,
  payload: JsonValue,
  clientActionId: string
): EngineActionEnvelope {
  if (!state.sessionId || !state.playerId) {
    throw new Error("session_or_player_missing");
  }

  return {
    sessionId: state.sessionId,
    expectedSeq: state.seq,
    actorPlayerId: state.playerId,
    actionType,
    payload,
    clientActionId
  };
}
