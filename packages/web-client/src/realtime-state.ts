import type { EngineActionEnvelope, JsonValue } from "@board-game-sim/shared";
import type { ServerEvent } from "./realtime-client";
export type { ServerEvent } from "./realtime-client";

export type ClientState = {
  sessionId: string | null;
  playerId: string | null;
  seq: number;
  view: JsonValue | null;
  patch: JsonValue | null;
  pendingActionId: string | null;
  lastError: string | null;
  terminal: { winnerPlayerId: string | null; reason: string } | null;
};

export function createInitialClientState(): ClientState {
  return {
    sessionId: null,
    playerId: null,
    seq: 0,
    view: null,
    patch: null,
    pendingActionId: null,
    lastError: null,
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
      seq: event.seq,
      view: event.view,
      patch: null,
      lastError: null
    };
  }

  if (event.type === "session.action_accepted") {
    return {
      ...state,
      seq: event.seq,
      pendingActionId: null,
      lastError: null
    };
  }

  if (event.type === "session.action_rejected") {
    return {
      ...state,
      pendingActionId: null,
      lastError: event.reason
    };
  }

  if (event.type === "session.state_patch") {
    return {
      ...state,
      seq: event.seq,
      patch: event.patch
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
