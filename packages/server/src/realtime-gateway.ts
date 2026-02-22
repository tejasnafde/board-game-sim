import type { JsonValue } from "@board-game-sim/shared";
import type { ClientEvent, ServerEvent } from "./protocol";
import { SessionService } from "./session-service";

// Supported games for on-demand session creation
const GAME_VERSIONS: Record<string, string> = {
  battleship: "0.1.0",
  labyrinth: "0.1.0"
};

function extractReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  const [reason] = error.message.split(":");
  return reason || "unknown_error";
}

export class RealtimeGateway {
  constructor(private readonly sessions: SessionService) { }

  async createStateSyncEvent(sessionId: string, playerId: string): Promise<ServerEvent> {
    await this.sessions.recoverSession(sessionId);
    return {
      type: "session.state_sync",
      sessionId,
      seq: this.sessions.getSessionSeq(sessionId),
      view: this.sessions.getPlayerView(sessionId, playerId) as JsonValue
    };
  }

  async handleClientEvent(event: ClientEvent): Promise<ServerEvent[]> {
    // ── Create session on demand ──────────────────────────────────────────────
    if (event.type === "session.create") {
      const gameVersion = GAME_VERSIONS[event.gameId];
      if (!gameVersion) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason: `game_not_supported:${event.gameId}`
          }
        ];
      }

      // Players: the creator is always player-1; a second player will join as player-2
      // We register both player-1 and player-2 upfront so the second player can join freely.
      const players = ["player-1", "player-2", "player-3", "player-4"];

      try {
        await this.sessions.createSession({
          sessionId: event.sessionId,
          gameId: event.gameId,
          gameVersion,
          seed: `${event.sessionId}-seed`,
          players
        });
      } catch (error) {
        const reason = extractReason(error);
        if (reason === "session_already_exists") {
          // Session exists — treat as a join instead
          return this.handleClientEvent({ type: "session.join", sessionId: event.sessionId, playerId: event.playerId });
        }
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason
          }
        ];
      }

      // Return created confirmation + initial state sync for creator
      return [
        {
          type: "session.created",
          sessionId: event.sessionId,
          gameId: event.gameId,
          players
        },
        await this.createStateSyncEvent(event.sessionId, event.playerId)
      ];
    }

    // ── Join existing session ─────────────────────────────────────────────────
    if (event.type === "session.join") {
      try {
        await this.sessions.recoverSession(event.sessionId);
      } catch (error) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason: extractReason(error)
          }
        ];
      }

      const meta = this.sessions.getSessionMeta(event.sessionId);
      if (!meta || !meta.players.includes(event.playerId)) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason: "actor_not_in_session"
          }
        ];
      }

      return [await this.createStateSyncEvent(event.sessionId, event.playerId)];
    }

    // ── Submit game action ────────────────────────────────────────────────────
    if (event.type === "action.submit") {
      const result = await this.sessions.submitAction(event.envelope);
      if (!result.accepted) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.envelope.sessionId,
            reason: result.reason ?? "invalid_action"
          }
        ];
      }

      const outbound: ServerEvent[] = [
        {
          type: "session.action_accepted",
          sessionId: event.envelope.sessionId,
          seq: result.seq,
          events: result.events.map((item) => ({
            eventType: item.eventType,
            payload: item.payload
          })) as JsonValue[]
        },
        {
          type: "session.state_patch",
          sessionId: event.envelope.sessionId,
          seq: result.seq,
          patch: { integrityHash: result.integrityHash }
        }
      ];

      const terminal = this.sessions.getTerminalResult(event.envelope.sessionId);
      if (terminal) {
        outbound.push({
          type: "session.terminal",
          sessionId: event.envelope.sessionId,
          winnerPlayerId: terminal.winnerPlayerId,
          reason: terminal.reason
        });
      }

      return outbound;
    }

    // v1 skeleton: leave/chat routing will be attached to room transport layer.
    return [];
  }
}
