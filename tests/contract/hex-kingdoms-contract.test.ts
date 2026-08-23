import { describe, expect, test } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository,
  SessionRuntime
} from "@board-game-sim/engine";
import {
  HexKingdomsModule,
  type HexKingdomsView
} from "@board-game-sim/hex-kingdoms";
import { SessionService } from "@board-game-sim/server";
import definition from "../../packages/games/hex-kingdoms/definition.json";

const meta = {
  sessionId: "hex-contract",
  gameId: "hex-kingdoms",
  gameVersion: "0.1.0",
  seed: "hex-contract-seed",
  players: ["p1", "p2"]
};

function registry() {
  const value = new InMemoryGameRegistry();
  value.register({
    gameId: "hex-kingdoms",
    version: "0.1.0",
    definition,
    module: new HexKingdomsModule()
  });
  return value;
}

async function submitFirstLegal(service: SessionService, sessionId: string) {
  const sessionMeta = service.getSessionMeta(sessionId)!;
  const views = sessionMeta.players.map((playerId) => (
    service.getPlayerView(sessionId, playerId) as HexKingdomsView
  ));
  const view = views.find((candidate) => candidate.canAct)!;
  const coordinate = view.legalCoordinates[0]!;
  return service.submitAction({
    sessionId,
    expectedSeq: service.getSessionSeq(sessionId),
    actorPlayerId: view.youPlayerId,
    actionType: "draft_and_place",
    payload: { marketTileId: view.market[0]!.id, ...coordinate },
    clientActionId: `hex-${service.getSessionSeq(sessionId)}`
  });
}

describe("Hex Kingdoms engine contract", () => {
  test("rejects stale sequence without changing authoritative state", async () => {
    const runtime = new SessionRuntime(
      new HexKingdomsModule(),
      new InMemoryEventRepository(),
      new InMemorySnapshotRepository()
    );
    await runtime.initSession(meta, definition);
    const before = structuredClone(runtime.getSession(meta.sessionId));
    const active = meta.players.find((playerId) => (
      (runtime.getPlayerView(meta.sessionId, playerId) as HexKingdomsView).canAct
    ))!;

    const stale = await runtime.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 9,
      actorPlayerId: active,
      actionType: "draft_and_place",
      payload: { marketTileId: "does-not-matter", q: 0, r: 0 },
      clientActionId: "stale"
    });

    expect(stale.accepted).toBe(false);
    expect(stale.reason).toBe("stale_sequence");
    expect(runtime.getSession(meta.sessionId)).toEqual(before);
  });

  test("redacts the private pile for every player, spectator, and event", async () => {
    const events = new InMemoryEventRepository();
    const runtime = new SessionRuntime(
      new HexKingdomsModule(),
      events,
      new InMemorySnapshotRepository()
    );
    const session = await runtime.initSession(meta, definition);
    const privateTileId = session.state.drawPile[0]!.id;

    for (const playerId of [...meta.players, "spectator"]) {
      const view = runtime.getPlayerView(meta.sessionId, playerId);
      expect(JSON.stringify(view)).not.toContain("drawPile");
      expect(JSON.stringify(view)).not.toContain(privateTileId);
    }
    expect(JSON.stringify(await events.list(meta.sessionId))).not.toContain(privateTileId);
  });

  test("recovers from snapshot plus action tail and continues to terminal", async () => {
    const events = new InMemoryEventRepository();
    const sessions = new InMemorySessionRepository();
    const snapshots = new InMemorySnapshotRepository();
    const first = new SessionService(registry(), events, sessions, snapshots, 5);
    await first.createSession(meta);

    for (let index = 0; index < 7; index += 1) {
      expect((await submitFirstLegal(first, meta.sessionId)).accepted).toBe(true);
    }
    const viewBeforeRecovery = first.getPlayerView(meta.sessionId, "p1");

    const recovered = new SessionService(registry(), events, sessions, snapshots, 5);
    await recovered.recoverSession(meta.sessionId);
    expect(recovered.getSessionSeq(meta.sessionId)).toBe(7);
    expect(recovered.getPlayerView(meta.sessionId, "p1")).toEqual(viewBeforeRecovery);
    expect(recovered.getSessionMeta(meta.sessionId)?.seed).toBe(meta.seed);

    while (!recovered.getTerminalResult(meta.sessionId)) {
      const accepted = await submitFirstLegal(recovered, meta.sessionId);
      expect(accepted.accepted, accepted.reason).toBe(true);
    }
    expect(recovered.getSessionSeq(meta.sessionId)).toBe(20);

    const frozen = await recovered.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: recovered.getSessionSeq(meta.sessionId),
      actorPlayerId: meta.players[0]!,
      actionType: "draft_and_place",
      payload: { marketTileId: "finished", q: 0, r: 0 },
      clientActionId: "after-terminal"
    });
    expect(frozen.accepted).toBe(false);
    expect(frozen.reason).toBe("session_terminal");
  });
});
