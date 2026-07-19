import { createLogger, createSeededRng, type GameBot, type JsonValue } from "@board-game-sim/shared";
import { battleshipBot } from "@board-game-sim/battleship";
import { labyrinthBot } from "@board-game-sim/labyrinth";
import { connect4Bot } from "@board-game-sim/connect4";
import battleshipDefinition from "../../games/battleship/definition.json";
import labyrinthDefinition from "../../games/labyrinth/definition.json";
import connect4Definition from "../../games/connect4/definition.json";
import type { ClientEvent, ServerEvent } from "./protocol";
import { SessionService } from "./session-service";

// Supported games for on-demand session creation. New game? Add a row.
const GAMES: Record<
  string,
  { version: string; minSeats: number; maxSeats: number; bot: GameBot; definition: JsonValue }
> = {
  battleship: { version: "0.1.0", minSeats: 2, maxSeats: 2, bot: battleshipBot, definition: battleshipDefinition as JsonValue },
  labyrinth: { version: "0.1.0", minSeats: 2, maxSeats: 4, bot: labyrinthBot, definition: labyrinthDefinition as JsonValue },
  connect4: { version: "0.1.0", minSeats: 2, maxSeats: 2, bot: connect4Bot, definition: connect4Definition as JsonValue }
};

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

export class RealtimeGateway {
  // Auto-claim seats: engine playerIds are fixed at init (turn order), but
  // humans type their own names. First join claims the first free seat; the
  // same name always maps back to its seat (reconnect-safe).
  // ponytail: names are trusted (friends-scale); auth if strangers ever join.
  private readonly claimsBySession = new Map<string, Map<string, string>>();

  // Seats played by the server (vs-computer mode), per session.
  private readonly botSeatsBySession = new Map<string, { gameId: string; seats: Set<string> }>();
  private readonly botLoopRunning = new Set<string>();

  /** Set by the transport layer to push room-wide syncs after paced bot moves. */
  onSessionChanged:
    | ((sessionId: string, events: { seq: number; items: JsonValue[] }) => Promise<void> | void)
    | null = null;

  constructor(
    private readonly sessions: SessionService,
    // 0 = bots reply inside the request (tests); >0 = paced, pushed via onSessionChanged
    private readonly botMoveDelayMs = 0
  ) { }

  /** Let bot seats act until it's a human's turn (or terminal / nothing to do). */
  async playBotSeats(sessionId: string): Promise<void> {
    const entry = this.botSeatsBySession.get(sessionId);
    const game = entry ? GAMES[entry.gameId] : undefined;
    if (!entry || !game) return;
    if (this.botLoopRunning.has(sessionId)) return;
    this.botLoopRunning.add(sessionId);
    try {
      await this.runBotLoop(sessionId, game);
    } finally {
      this.botLoopRunning.delete(sessionId);
    }
  }

  private async runBotLoop(sessionId: string, game: (typeof GAMES)[string]): Promise<void> {
    const entry = this.botSeatsBySession.get(sessionId);
    if (!entry) return;

    for (let move = 0; move < MAX_BOT_MOVES; move += 1) {
      if (this.sessions.getTerminalResult(sessionId)) return;

      let acted = false;
      for (const seat of entry.seats) {
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
    let claims = this.claimsBySession.get(sessionId);
    if (claims?.has(name)) return claims.get(name)!;

    const meta = this.sessions.getSessionMeta(sessionId);
    if (!meta) return null;
    if (!claims) {
      claims = new Map();
      this.claimsBySession.set(sessionId, claims);
    }

    const taken = new Set(claims.values());
    // Prefer identity: a name that IS a roster seat gets that exact seat
    // (explicit rosters and bots address seats by name).
    const seat = meta.players.includes(name) && !taken.has(name)
      ? name
      : meta.players.find((s) => !taken.has(s));
    if (!seat) {
      log.warn(`${sessionId} seat claim failed for "${name}" — session full`);
      return null;
    }
    claims.set(name, seat);
    log.info(`${sessionId} "${name}" claimed seat ${seat}`);
    return seat;
  }

  getTerminal(sessionId: string): { winnerPlayerId: string | null; reason: string } | null {
    return this.sessions.getTerminalResult(sessionId);
  }

  private seatNames(sessionId: string): Record<string, string> {
    const claims = this.claimsBySession.get(sessionId);
    const seats: Record<string, string> = {};
    for (const [name, seat] of claims ?? []) seats[seat] = name;
    return seats;
  }

  async createStateSyncEvent(sessionId: string, playerName: string): Promise<ServerEvent> {
    await this.sessions.recoverSession(sessionId);
    const seat = this.resolveSeat(sessionId, playerName);
    if (!seat) {
      return { type: "session.action_rejected", sessionId, reason: "session_full" };
    }
    return {
      type: "session.state_sync",
      sessionId,
      seq: this.sessions.getSessionSeq(sessionId),
      view: this.sessions.getPlayerView(sessionId, seat) as JsonValue,
      youAre: seat,
      seats: this.seatNames(sessionId)
    };
  }

  async handleClientEvent(event: ClientEvent): Promise<ServerEvent[]> {
    // ── Create session on demand ──────────────────────────────────────────────
    if (event.type === "session.create") {
      const game = GAMES[event.gameId];
      if (!game) {
        return [
          {
            type: "session.action_rejected",
            sessionId: event.sessionId,
            reason: `game_not_supported:${event.gameId}`
          }
        ];
      }

      // Roster: the turn loop cycles through this exact list, so it must match
      // the humans who will actually play — empty seats deadlock the game.
      // Explicit `players` wins (tests/bots); otherwise generic seats sized by
      // seatCount, claimed by name as people join.
      const seatCount = Math.min(
        game.maxSeats,
        Math.max(game.minSeats, event.seatCount ?? game.minSeats)
      );
      const players = event.players && event.players.length >= 2
        ? event.players
        : Array.from({ length: seatCount }, (_, i) => `player-${i + 1}`);

      try {
        await this.sessions.createSession({
          sessionId: event.sessionId,
          gameId: event.gameId,
          gameVersion: game.version,
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

      // Creator claims seat 1 before any bots claim theirs.
      this.resolveSeat(event.sessionId, event.playerId);

      const botCount = Math.min(event.bots ?? 0, players.length - 1);
      if (botCount > 0) {
        const seats = new Set<string>();
        for (let i = 0; i < botCount; i += 1) {
          const name = botCount === 1 ? "Computer" : `Computer ${i + 1}`;
          const seat = this.resolveSeat(event.sessionId, name);
          if (seat) seats.add(seat);
        }
        this.botSeatsBySession.set(event.sessionId, { gameId: event.gameId, seats });
        await this.kickBots(event.sessionId);
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

      return [await this.createStateSyncEvent(event.sessionId, event.playerId)];
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
