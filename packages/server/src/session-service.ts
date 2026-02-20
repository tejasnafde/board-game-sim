import { SessionRuntime } from "@board-game-sim/engine/runtime";
import type { GameModule, SessionMetadata } from "@board-game-sim/shared";
import type { EventRepository, SnapshotRepository } from "@board-game-sim/engine/store";

export class SessionService<State> {
  private readonly runtime: SessionRuntime<State>;

  constructor(
    module: GameModule<State>,
    eventRepo: EventRepository,
    snapshotRepo: SnapshotRepository
  ) {
    this.runtime = new SessionRuntime(module, eventRepo, snapshotRepo);
  }

  async createSession(meta: SessionMetadata, definition: unknown): Promise<void> {
    await this.runtime.initSession(meta, definition);
  }

  getRuntime(): SessionRuntime<State> {
    return this.runtime;
  }
}
