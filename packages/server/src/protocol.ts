import type { EngineActionEnvelope, JsonValue } from "@board-game-sim/shared";

export type ClientEvent =
  | { type: "session.create"; sessionId: string; gameId: string; playerId: string }
  | { type: "session.join"; sessionId: string; playerId: string }
  | { type: "action.submit"; envelope: EngineActionEnvelope }
  | { type: "session.leave"; sessionId: string; playerId: string }
  | { type: "chat.send"; sessionId: string; playerId: string; message: string };

export type ServerEvent =
  | { type: "session.state_sync"; sessionId: string; seq: number; view: JsonValue }
  | { type: "session.created"; sessionId: string; gameId: string; players: string[] }
  | { type: "session.action_accepted"; sessionId: string; seq: number; events: JsonValue[] }
  | { type: "session.action_rejected"; sessionId: string; reason: string }
  | { type: "session.state_patch"; sessionId: string; seq: number; patch: JsonValue }
  | { type: "session.terminal"; sessionId: string; winnerPlayerId: string | null; reason: string };
