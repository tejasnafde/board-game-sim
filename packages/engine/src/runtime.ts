import type {
  EngineActionEnvelope,
  GameEvent,
  GameModule,
  SessionMetadata,
  SessionSnapshot
} from "@board-game-sim/shared";
import { deterministicHash } from "@board-game-sim/shared";
import type { EventRepository, SnapshotRepository } from "./store";

type RuntimeSession<State> = {
  meta: SessionMetadata;
  seq: number;
  state: State;
  integrityHash: string;
  terminal: boolean;
};

export type RuntimeResult<State> = {
  accepted: boolean;
  reason?: string;
  seq: number;
  state: State;
  integrityHash: string;
  events: GameEvent[];
};

export class SessionRuntime<State> {
  private readonly sessions = new Map<string, RuntimeSession<State>>();

  constructor(
    private readonly gameModule: GameModule<State>,
    private readonly eventRepo: EventRepository,
    private readonly snapshotRepo: SnapshotRepository,
    private readonly snapshotEvery = 10
  ) {}

  async initSession(meta: SessionMetadata, definition: unknown): Promise<RuntimeSession<State>> {
    if (this.sessions.has(meta.sessionId)) {
      throw new Error(`session_already_exists:${meta.sessionId}`);
    }

    const initialized = this.gameModule.initGame({
      sessionId: meta.sessionId,
      gameId: meta.gameId,
      gameVersion: meta.gameVersion,
      seed: meta.seed,
      players: meta.players,
      definition: definition as never
    });

    const session: RuntimeSession<State> = {
      meta,
      seq: 0,
      state: initialized.initialState,
      integrityHash: initialized.integrityHash,
      terminal: false
    };

    this.sessions.set(meta.sessionId, session);

    for (const event of initialized.emittedEvents) {
      await this.eventRepo.append({
        sessionId: meta.sessionId,
        seq: 0,
        actorPlayerId: "system",
        eventType: event.eventType,
        payload: event.payload,
        createdAt: new Date().toISOString()
      });
    }

    await this.snapshotRepo.put({
      sessionId: meta.sessionId,
      seq: 0,
      stateBlob: session.state as never,
      integrityHash: session.integrityHash,
      createdAt: new Date().toISOString()
    });

    return session;
  }

  getSession(sessionId: string): RuntimeSession<State> | undefined {
    return this.sessions.get(sessionId);
  }

  getPlayerView(sessionId: string, playerId: string): unknown {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session_not_found:${sessionId}`);
    }
    return this.gameModule.getPlayerView({ state: session.state, playerId }).visibleState;
  }

  async submitAction(envelope: EngineActionEnvelope): Promise<RuntimeResult<State>> {
    const session = this.sessions.get(envelope.sessionId);
    if (!session) {
      return {
        accepted: false,
        reason: "session_not_found",
        seq: -1,
        state: {} as State,
        integrityHash: "",
        events: []
      };
    }

    if (session.terminal) {
      return {
        accepted: false,
        reason: "session_terminal",
        seq: session.seq,
        state: session.state,
        integrityHash: session.integrityHash,
        events: []
      };
    }

    if (envelope.expectedSeq !== session.seq) {
      return {
        accepted: false,
        reason: "stale_sequence",
        seq: session.seq,
        state: session.state,
        integrityHash: session.integrityHash,
        events: []
      };
    }

    if (!session.meta.players.includes(envelope.actorPlayerId)) {
      return {
        accepted: false,
        reason: "actor_not_in_session",
        seq: session.seq,
        state: session.state,
        integrityHash: session.integrityHash,
        events: []
      };
    }

    const legalActions = this.gameModule.listLegalActions(session.state, envelope.actorPlayerId);
    const actionIsLegal = legalActions.some((action) => action.actionType === envelope.actionType);
    if (!actionIsLegal) {
      return {
        accepted: false,
        reason: "illegal_action",
        seq: session.seq,
        state: session.state,
        integrityHash: session.integrityHash,
        events: []
      };
    }

    const nextSeq = session.seq + 1;
    const applied = this.gameModule.applyAction({
      sessionId: envelope.sessionId,
      seq: nextSeq,
      actorPlayerId: envelope.actorPlayerId,
      actionType: envelope.actionType,
      payload: envelope.payload,
      state: session.state,
      seed: session.meta.seed
    });

    if (!applied.accepted) {
      return {
        accepted: false,
        reason: applied.reason ?? "invalid_action",
        seq: session.seq,
        state: session.state,
        integrityHash: session.integrityHash,
        events: []
      };
    }

    const persistedEvents: GameEvent[] = [];
    for (const emitted of applied.emittedEvents) {
      const event: GameEvent = {
        sessionId: envelope.sessionId,
        seq: nextSeq,
        actorPlayerId: envelope.actorPlayerId,
        eventType: emitted.eventType,
        payload: emitted.payload,
        createdAt: new Date().toISOString()
      };
      await this.eventRepo.append(event);
      persistedEvents.push(event);
    }

    session.seq = nextSeq;
    session.state = applied.nextState;
    session.integrityHash = applied.integrityHash || deterministicHash(applied.nextState);
    session.terminal = this.gameModule.isTerminal(session.state) !== null;

    if (session.seq % this.snapshotEvery === 0 || session.terminal) {
      const snapshot: SessionSnapshot = {
        sessionId: envelope.sessionId,
        seq: session.seq,
        stateBlob: session.state as never,
        integrityHash: session.integrityHash,
        createdAt: new Date().toISOString()
      };
      await this.snapshotRepo.put(snapshot);
    }

    return {
      accepted: true,
      seq: session.seq,
      state: session.state,
      integrityHash: session.integrityHash,
      events: persistedEvents
    };
  }
}
