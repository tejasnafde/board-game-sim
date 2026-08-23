import { describe, expect, test } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository,
  SessionRuntime
} from "@board-game-sim/engine";
import { createSeededRng, type JsonValue } from "@board-game-sim/shared";
import {
  SignalCrewModule,
  signalCrewBot,
  type SignalCrewView
} from "@board-game-sim/signal-crew";
import { SessionService } from "@board-game-sim/server";
import definition from "../../packages/games/signal-crew/definition.json";

const meta = {
  sessionId: "signal-contract",
  gameId: "signal-crew",
  gameVersion: "0.1.0",
  seed: "signal-contract-seed",
  players: ["p1", "p2", "p3"]
};

function registry() {
  const value = new InMemoryGameRegistry();
  value.register({
    gameId: "signal-crew",
    version: "0.1.0",
    definition,
    module: new SignalCrewModule()
  });
  return value;
}

async function submitBot(service: SessionService, sessionId: string) {
  const sessionMeta = service.getSessionMeta(sessionId)!;
  const views = sessionMeta.players.map((playerId) => ({
    playerId,
    view: service.getPlayerView(sessionId, playerId) as SignalCrewView
  }));
  const active = views.find(({ view }) => view.canAct)!;
  const seq = service.getSessionSeq(sessionId);
  const action = signalCrewBot({
    view: active.view as unknown as JsonValue,
    definition,
    playerId: active.playerId,
    rng: createSeededRng(`${sessionId}:${active.playerId}:${seq}`)
  })!;
  return service.submitAction({
    sessionId,
    expectedSeq: seq,
    actorPlayerId: active.playerId,
    actionType: action.actionType,
    payload: action.payload,
    clientActionId: `signal-${seq}`
  });
}

describe("Signal Crew engine contract", () => {
  test("stale and illegal actions reject without changing authoritative state", async () => {
    const runtime = new SessionRuntime(
      new SignalCrewModule(),
      new InMemoryEventRepository(),
      new InMemorySnapshotRepository()
    );
    await runtime.initSession(meta, definition);
    const before = structuredClone(runtime.getSession(meta.sessionId));
    const stale = await runtime.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 4,
      actorPlayerId: "p1",
      actionType: "stand_by",
      payload: {},
      clientActionId: "stale"
    });
    expect(stale).toMatchObject({ accepted: false, reason: "stale_sequence" });
    expect(runtime.getSession(meta.sessionId)).toEqual(before);
  });

  test("personalized and spectator views cannot expose held faces or deck order", async () => {
    const runtime = new SessionRuntime(
      new SignalCrewModule(),
      new InMemoryEventRepository(),
      new InMemorySnapshotRepository()
    );
    const session = await runtime.initSession(meta, definition);
    for (const playerId of meta.players) {
      const view = runtime.getPlayerView(meta.sessionId, playerId) as SignalCrewView;
      const ownIds = session.state.hands[playerId]!;
      for (const packetId of ownIds) {
        const packet = view.hands.flatMap((hand) => hand.packets).find((candidate) => candidate.packetId === packetId)!;
        expect(packet.concealed).toBe(true);
        expect(packet).not.toHaveProperty("face");
      }
      expect(JSON.stringify(view)).not.toContain("\"deck\"");
    }
    const spectator = runtime.getPlayerView(meta.sessionId, "spectator") as SignalCrewView;
    expect(spectator.hands.every((hand) => hand.packets.every((packet) => packet.concealed))).toBe(true);
    expect(spectator.legalActionTypes).toEqual([]);
  });

  test("snapshot plus tail recovery preserves perspective and reaches cooperative terminal", async () => {
    const events = new InMemoryEventRepository();
    const sessions = new InMemorySessionRepository();
    const snapshots = new InMemorySnapshotRepository();
    const first = new SessionService(registry(), events, sessions, snapshots, 5);
    await first.createSession(meta);
    for (let index = 0; index < 7 && !first.getTerminalResult(meta.sessionId); index += 1) {
      const result = await submitBot(first, meta.sessionId);
      expect(result.accepted, result.reason).toBe(true);
    }
    const seq = first.getSessionSeq(meta.sessionId);
    const before = first.getPlayerView(meta.sessionId, "p2");

    const recovered = new SessionService(registry(), events, sessions, snapshots, 5);
    await recovered.recoverSession(meta.sessionId);
    expect(recovered.getSessionSeq(meta.sessionId)).toBe(seq);
    expect(recovered.getPlayerView(meta.sessionId, "p2")).toEqual(before);
    while (!recovered.getTerminalResult(meta.sessionId)) {
      const result = await submitBot(recovered, meta.sessionId);
      expect(result.accepted, result.reason).toBe(true);
    }
    expect(recovered.getTerminalResult(meta.sessionId)).toMatchObject({ winnerPlayerId: null });
    const frozen = await recovered.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: recovered.getSessionSeq(meta.sessionId),
      actorPlayerId: "p1",
      actionType: "stand_by",
      payload: {},
      clientActionId: "after-terminal"
    });
    expect(frozen).toMatchObject({ accepted: false, reason: "session_terminal" });
  });
});
