import type { GameEvent, SessionSnapshot } from "@board-game-sim/shared/types/persistence";
import type { SessionMetadata } from "@board-game-sim/shared/types/engine";

export interface EventRepository {
  append(event: GameEvent): Promise<void>;
  list(sessionId: string): Promise<GameEvent[]>;
}

export interface SnapshotRepository {
  put(snapshot: SessionSnapshot): Promise<void>;
  getLatest(sessionId: string): Promise<SessionSnapshot | null>;
}

export interface SessionRepository {
  put(meta: SessionMetadata): Promise<void>;
  get(sessionId: string): Promise<SessionMetadata | null>;
}

export class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, GameEvent[]>();

  async append(event: GameEvent): Promise<void> {
    const current = this.events.get(event.sessionId) ?? [];
    current.push(event);
    this.events.set(event.sessionId, current);
  }

  async list(sessionId: string): Promise<GameEvent[]> {
    return this.events.get(sessionId) ?? [];
  }
}

export class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly snapshots = new Map<string, SessionSnapshot>();

  async put(snapshot: SessionSnapshot): Promise<void> {
    this.snapshots.set(snapshot.sessionId, snapshot);
  }

  async getLatest(sessionId: string): Promise<SessionSnapshot | null> {
    return this.snapshots.get(sessionId) ?? null;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionMetadata>();

  async put(meta: SessionMetadata): Promise<void> {
    this.sessions.set(meta.sessionId, meta);
  }

  async get(sessionId: string): Promise<SessionMetadata | null> {
    return this.sessions.get(sessionId) ?? null;
  }
}
