import { createLogger, createSeededRng, type JsonValue } from "@board-game-sim/shared";
import type { ClientEvent, ServerEvent } from "./protocol";
import { SessionService } from "./session-service";
import { noAnalytics, type GamingAnalytics } from "./analytics";
import { normalizeTablePlan, TableRoster } from "./table-roster";
import { createPrivateSessionSeed, type SessionSeedFactory } from "./session-seed";
import { resolveBuiltInGame, type BuiltInGame } from "./game-catalog";

// Safety cap on consecutive bot moves per trigger (multi-bot rounds are legal;
// an infinitely-looping module bug is not).
const MAX_BOT_MOVES = 50;

const log = createLogger("gateway");

function extractReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  const [reason] = error.message.split(":");
  return reason || "unknown_error";
}

function isValidTablePlan(plan: { humanSeats: number; botSeats: number }, minSeats: number, maxSeats: number): boolean {
  const totalSeats = plan.humanSeats + plan.botSeats;
  return Number.isInteger(plan.humanSeats)
    && Number.isInteger(plan.botSeats)
    && plan.humanSeats >= 1
    && plan.botSeats >= 0
    && totalSeats >= minSeats
    && totalSeats <= maxSeats;
}

export class RealtimeGateway {
  private readonly tableGames = new Map<string, string>();
  private readonly botLoopRunning = new Set<string>();

  /** Set by the transport layer to push room-wide syncs after paced bot moves. */
  onSessionChanged:
    | ((sessionId: string, action: { seq: number; actorPlayerId: string; items: JsonValue[] }) => Promise<void> | void)
    | null = null;

  constructor(
    private readonly sessions: SessionService,
    // 0 = bots reply inside the request (tests); >0 = paced, pushed via onSessionChanged
    private readonly botMoveDelayMs = 0,
    private readonly analytics: GamingAnalytics = noAnalytics,
    private readonly tables = new TableRoster(),
    private readonly seedFactory: SessionSeedFactory = createPrivateSessionSeed
  ) { }

  /** Let bot seats act until it's a human's turn (or terminal / nothing to do). */
  async playBotSeats(sessionId: string): Promise<void> {
    if (!this.ensureTable(sessionId)) return;
    if (!this.tables.summary(sessionId).ready) return;
    const gameId = this.tableGames.get(sessionId);
    const game = gameId ? resolveBuiltInGame(gameId) : null;
    if (!game) return;
    if (this.botLoopRunning.has(sessionId)) return;
    this.botLoopRunning.add(sessionId);
    try {
      await this.runBotLoop(sessionId, game);
    } finally {
      this.botLoopRunning.delete(sessionId);
    }
  }

  private async runBotLoop(sessionId: string, game: BuiltInGame): Promise<void> {
    const botSeats = this.tables.botSeats(sessionId);

    for (let move = 0; move < MAX_BOT_MOVES; move += 1) {
      if (this.sessions.getTerminalResult(sessionId)) return;

      let acted = false;
      for (const seat of botSeats) {
        const view = this.sessions.getPlayerView(sessionId, seat) as JsonValue;
        const seq = this.sessions.getSessionSeq(sessionId);
        const action = game.bot({
          view,
          definition: game.definition,
          playerId: seat,
          rng: createSeededRng(`${sessionId}:${seat}:${seq}`)
        });
        if (!action) continue;

        const result = await this.sessions.submitAction({
          sessionId,
          expectedSeq: seq,
          actorPlayerId: seat,
          actionType: action.actionType,
          payload: action.payload,
          clientActionId: `bot-${seat}-${seq}`
        });
        // A bot proposing an illegal move is a game bug; stop rather than spin.
        if (!result.accepted) {
          log.error(`${sessionId} 🤖 ${seat} move REJECTED (${result.reason}) — game bug, bot stopping`);
          return;
        }
        log.info(`${sessionId} 🤖 ${seat} → ${action.actionType} ${JSON.stringify(action.payload)}`);
        await this.onSessionChanged?.(sessionId, {
          seq: result.seq,
          actorPlayerId: seat,
          items: result.events.map((e) => ({ eventType: e.eventType, payload: e.payload })) as JsonValue[]
        });
        acted = true;
        break;
      }
      if (!acted) return;
      if (this.botMoveDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.botMoveDelayMs));
      }
    }
  }

  /** Paced mode floats the bot loop; synchronous mode (tests) awaits it. */
  private kickBots(sessionId: string): Promise<void> {
    if (this.botMoveDelayMs > 0) {
      void this.playBotSeats(sessionId).catch((error) => log.error(`${sessionId} bot loop crashed`, error));
      return Promise.resolve();
    }
    return this.playBotSeats(sessionId);
  }

  private resolveSeat(sessionId: string, name: string): string | null {
    if (!this.ensureTable(sessionId)) return null;
    const seat = this.tables.claimHuman(sessionId, name);
    if (!seat) {
      log.warn(`${sessionId} seat claim failed for "${name}" — session full`);
      return null;
    }
    log.info(`${sessionId} "${name}" claimed seat ${seat}`);
    return seat;
  }

  private ensureTable(sessionId: string): boolean {
    if (this.tables.has(sessionId)) return true;
    const meta = this.sessions.getSessionMeta(sessionId);
    if (!meta) return false;
    this.tables.create(sessionId, meta.players, { humanSeats: meta.players.length, botSeats: 0 });
    for (const playerId of meta.players) this.tables.claimHuman(sessionId, playerId);
    this.tableGames.set(sessionId, meta.gameId);
    return true;
  }

  getTerminal(sessionId: string): { winnerPlayerId: string | null; reason: string } | null {
    return this.sessions.getTerminalResult(sessionId);
  }

  private seatNames(sessionId: string): Record<string, string> {
    return this.tables.seatNames(sessionId);
  }

  async createStateSyncEvent(sessionId: string, playerName: string): Promise<ServerEvent> {
    await this.sessions.recoverSession(sessionId);
    const seat = this.resolveSeat(sessionId, playerName);
    if (!seat) {
      return { type: "session.action_rejected", sessionId, reason: "session_full" };
    }
    return this.stateSyncEvent(sessionId, seat);
  }

  private stateSyncEvent(sessionId: string, seat: string): ServerEvent {
    return {
      type: "session.state_sync",
      sessionId,
      seq: this.sessions.getSessionSeq(sessionId),
      view: this.sessions.getPlayerView(sessionId, seat) as JsonValue,
      youAre: seat,
      seats: this.seatNames(sessionId),
      table: this.tables.summary(sessionId)
    };
  }

  async handleClientEvent(event: ClientEvent): Promise<ServerEvent[]> {
    // ── Create session on demand ──────────────────────────────────────────────
    if (event.type === "session.create") {
      const game = resolveBuiltInGame(event.gameId);
      if (!game) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason: `game_not_supported:${event.gameId}`
          }
        ];
      }

      const tablePlan = event.players
        ? { humanSeats: event.players.length, botSeats: 0 }
        : normalizeTablePlan(event, game.minSeats, game.maxSeats);
      if (!isValidTablePlan(tablePlan, game.minSeats, game.maxSeats)) {
        return [{
          type: "session.action_rejected",
          sessionId: event.sessionId,
          reason: "invalid_table_plan"
        }];
      }
      const seatCount = tablePlan.humanSeats + tablePlan.botSeats;
      const players = event.players && event.players.length >= 2
        ? event.players
        : Array.from({ length: seatCount }, (_, i) => `player-${i + 1}`);

      try {
        await this.sessions.createSession({
          sessionId: event.sessionId,
          gameId: event.gameId,
          gameVersion: game.version,
          seed: this.seedFactory({ sessionId: event.sessionId, gameId: event.gameId }),
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

      this.tables.create(event.sessionId, players, tablePlan);
      this.tableGames.set(event.sessionId, event.gameId);
      if (event.players) {
        for (const playerId of players) this.tables.claimHuman(event.sessionId, playerId);
      } else {
        this.tables.claimHuman(event.sessionId, event.playerId);
      }
      await this.kickBots(event.sessionId);

      this.analytics.track("session_created", "lobby", { variant: event.gameId });

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

      const seat = this.resolveSeat(event.sessionId, event.playerId);
      if (!seat) {
        return [{ type: "session.action_rejected", sessionId: event.sessionId, reason: "session_full" }];
      }
      if (this.tables.summary(event.sessionId).ready) await this.kickBots(event.sessionId);
      return [this.stateSyncEvent(event.sessionId, seat)];
    }

    // ── Submit game action ────────────────────────────────────────────────────
    if (event.type === "action.submit") {
      const seat = this.resolveSeat(event.envelope.sessionId, event.envelope.actorPlayerId);
      if (!seat) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.envelope.sessionId,
            reason: "actor_not_in_session"
          }
        ];
      }
      if (!this.tables.summary(event.envelope.sessionId).ready) {
        return [{
          type: "session.action_rejected",
          sessionId: event.envelope.sessionId,
          reason: "table_not_ready"
        }];
      }
      const result = await this.sessions.submitAction({ ...event.envelope, actorPlayerId: seat });
      if (!result.accepted) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.envelope.sessionId,
            reason: result.reason ?? "invalid_action"
          }
        ];
      }

      await this.kickBots(event.envelope.sessionId);

      const meta = this.sessions.getSessionMeta(event.envelope.sessionId);
      if (result.seq === 1 && meta) {
        this.analytics.track("gameplay_started", "gameplay", { variant: meta.gameId });
      }

      const outbound: ServerEvent[] = [{
        type: "session.action_accepted",
        sessionId: event.envelope.sessionId,
        seq: result.seq,
        actorPlayerId: seat,
        events: result.events.map((item) => ({
          eventType: item.eventType,
          payload: item.payload
        })) as JsonValue[]
      }];

      const terminal = this.sessions.getTerminalResult(event.envelope.sessionId);
      if (terminal) {
        if (meta) {
          this.analytics.track("game_completed", "gameplay", { variant: meta.gameId });
        }
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
