import type { GameEvent, SessionSnapshot } from "@board-game-sim/shared/types/persistence";

export interface EventRepository {
  append(event: GameEvent): Promise<void>;
  list(sessionId: string): Promise<GameEvent[]>;
}

export interface SnapshotRepository {
  put(snapshot: SessionSnapshot): Promise<void>;
  getLatest(sessionId: string): Promise<SessionSnapshot | null>;
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
