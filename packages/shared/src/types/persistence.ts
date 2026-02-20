import type { JsonValue } from "./contracts";

export type GameEvent = {
  sessionId: string;
  seq: number;
  actorPlayerId: string;
  eventType: string;
  payload: JsonValue;
  createdAt: string;
};

export type SessionSnapshot = {
  sessionId: string;
  seq: number;
  stateBlob: JsonValue;
  integrityHash: string;
  createdAt: string;
};
