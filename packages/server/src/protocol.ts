import type { EngineActionEnvelope, JsonValue, TablePlan, TableSummary } from "@board-game-sim/shared";

export type ClientEvent =
  | { type: "session.create"; sessionId: string; gameId: string; playerId: string; players?: string[]; tablePlan?: TablePlan; seatCount?: number; bots?: number }
  | { type: "session.join"; sessionId: string; playerId: string }
  | { type: "action.submit"; envelope: EngineActionEnvelope }
  | { type: "session.leave"; sessionId: string; playerId: string }
  | { type: "chat.send"; sessionId: string; playerId: string; message: string };

export type ServerEvent =
  | { type: "session.state_sync"; sessionId: string; seq: number; view: JsonValue; youAre?: string; seats?: Record<string, string>; table?: TableSummary }
  | { type: "session.created"; sessionId: string; gameId: string; players: string[] }
  | { type: "session.action_accepted"; sessionId: string; seq: number; actorPlayerId?: string; events: JsonValue[] }
  | { type: "session.action_rejected"; sessionId: string; reason: string }
  | { type: "session.terminal"; sessionId: string; winnerPlayerId: string | null; reason: string };
