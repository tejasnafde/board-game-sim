import type { JsonValue } from "@board-game-sim/shared";
import type { ClientEvent, ServerEvent } from "./protocol";
import { SessionService } from "./session-service";

function extractReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  const [reason] = error.message.split(":");
  return reason || "unknown_error";
}

export class RealtimeGateway {
  constructor(private readonly sessions: SessionService) {}

  async handleClientEvent(event: ClientEvent): Promise<ServerEvent[]> {
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

      return [
        {
          type: "session.state_sync",
          sessionId: event.sessionId,
          seq: this.sessions.getSessionSeq(event.sessionId),
          view: this.sessions.getPlayerView(event.sessionId, event.playerId) as JsonValue
        }
      ];
    }

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

