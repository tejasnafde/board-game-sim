import type { JsonValue } from "./contracts";

export type EngineActionEnvelope = {
  sessionId: string;
  expectedSeq: number;
  actorPlayerId: string;
  actionType: string;
  payload: JsonValue;
  clientActionId: string;
};

export type SessionMetadata = {
  sessionId: string;
  gameId: string;
  gameVersion: string;
  seed: string;
  players: string[];
};
