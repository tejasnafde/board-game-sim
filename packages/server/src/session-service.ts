import { createLogger, type EngineActionEnvelope, type SessionMetadata } from "@board-game-sim/shared";
import {
  SessionRuntime,
  type GameRegistry,
  type EventRepository,
  type SessionRepository,
  type SnapshotRepository
} from "@board-game-sim/engine";

type SessionRuntimeEntry = {
  runtime: SessionRuntime<unknown>;
  meta: SessionMetadata;
};

const log = createLogger("session");

export class SessionService {
  private readonly sessions = new Map<string, SessionRuntimeEntry>();

  constructor(
    private readonly registry: GameRegistry,
    private readonly eventRepo: EventRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly snapshotRepo: SnapshotRepository,
    private readonly snapshotEvery = 10
  ) {}

  async createSession(meta: SessionMetadata): Promise<void> {
    if (this.sessions.has(meta.sessionId)) {
      throw new Error(`session_already_exists:${meta.sessionId}`);
    }

    const resolved = this.registry.resolve(meta.gameId, meta.gameVersion);
    if (!resolved) {
      throw new Error(`game_not_registered:${meta.gameId}@${meta.gameVersion}`);
    }

    const runtime = new SessionRuntime(
      resolved.module,
      this.eventRepo,
      this.snapshotRepo,
      this.snapshotEvery
    );
    await runtime.initSession(meta, resolved.definition);
    await this.sessionRepo.put(meta);
    this.sessions.set(meta.sessionId, { runtime: runtime as SessionRuntime<unknown>, meta });
    log.info(`${meta.sessionId} created (${meta.gameId}@${meta.gameVersion}, ${meta.players.length} seats)`);
  }

  async recoverSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      return;
    }

    const meta = await this.sessionRepo.get(sessionId);
    if (!meta) {
      throw new Error(`session_not_found:${sessionId}`);
    }

    const resolved = this.registry.resolve(meta.gameId, meta.gameVersion);
    if (!resolved) {
      throw new Error(`game_not_registered:${meta.gameId}@${meta.gameVersion}`);
    }

    const runtime = new SessionRuntime(
      resolved.module,
      this.eventRepo,
      this.snapshotRepo,
      this.snapshotEvery
    );
    const latestSnapshot = await this.snapshotRepo.getLatest(sessionId);
    log.info(`${sessionId} recovering (snapshot=${latestSnapshot ? `seq ${latestSnapshot.seq}` : "none"})`);

    if (!latestSnapshot) {
      await runtime.initSession(meta, resolved.definition);
      this.sessions.set(meta.sessionId, { runtime: runtime as SessionRuntime<unknown>, meta });
      return;
    }

    runtime.hydrateSession(meta, latestSnapshot);

    const tailAcceptedActions = (await this.eventRepo.list(sessionId))
      .filter((event) => event.seq > latestSnapshot.seq && event.eventType === "action.accepted")
      .sort((a, b) => a.seq - b.seq);

    for (const actionEvent of tailAcceptedActions) {
      const payload = actionEvent.payload as {
        actionType: string;
        payload: unknown;
      };
      runtime.replayAcceptedAction(sessionId, {
        seq: actionEvent.seq,
        actorPlayerId: actionEvent.actorPlayerId,
        actionType: payload.actionType,
        payload: payload.payload as never
      });
    }

    this.sessions.set(meta.sessionId, { runtime: runtime as SessionRuntime<unknown>, meta });
  }

  async submitAction(envelope: EngineActionEnvelope) {
    const entry = this.sessions.get(envelope.sessionId);
    if (!entry) {
      return {
        accepted: false as const,
        reason: "session_not_found",
        seq: -1,
        state: {},
        integrityHash: "",
        events: []
      };
    }

    return entry.runtime.submitAction(envelope);
  }

  getPlayerView(sessionId: string, playerId: string): unknown {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`session_not_found:${sessionId}`);
    }
    return entry.runtime.getPlayerView(sessionId, playerId);
  }

  getSessionSeq(sessionId: string): number {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`session_not_found:${sessionId}`);
    }
    return entry.runtime.getSeq(sessionId);
  }

  getTerminalResult(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`session_not_found:${sessionId}`);
    }
    return entry.runtime.getTerminalResult(sessionId);
  }

  getSessionMeta(sessionId: string): SessionMetadata | null {
    return this.sessions.get(sessionId)?.meta ?? null;
  }
}
