import type { EngineActionEnvelope, SessionMetadata } from "@board-game-sim/shared";
import { SessionRuntime, type GameRegistry, type EventRepository, type SnapshotRepository } from "@board-game-sim/engine";

type SessionRuntimeEntry = {
  runtime: SessionRuntime<unknown>;
  meta: SessionMetadata;
};

export class SessionService {
  private readonly sessions = new Map<string, SessionRuntimeEntry>();

  constructor(
    private readonly registry: GameRegistry,
    private readonly eventRepo: EventRepository,
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

  getSessionMeta(sessionId: string): SessionMetadata | null {
    return this.sessions.get(sessionId)?.meta ?? null;
  }
}
