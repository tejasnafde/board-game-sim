import { describe, expect, test } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { SessionService } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

const miniDefinition = {
  ...definition,
  ships: [{ id: "destroyer", size: 2 }]
};

function makeService() {
  const registry = new InMemoryGameRegistry();
  registry.register({
    gameId: "battleship",
    version: "0.1.0",
    definition: miniDefinition,
    module: new BattleshipModule()
  });

  return new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );
}

describe("session service", () => {
  test("creates session via registry and routes actions", async () => {
    const service = makeService();

    await service.createSession({
      sessionId: "ss-1",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const result = await service.submitAction({
      sessionId: "ss-1",
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      clientActionId: "ca-1"
    });

    expect(result.accepted).toBe(true);
    expect(result.seq).toBe(1);
  });

  test("rejects creation when game is not registered", async () => {
    const service = new SessionService(
      new InMemoryGameRegistry(),
      new InMemoryEventRepository(),
      new InMemorySessionRepository(),
      new InMemorySnapshotRepository()
    );

    await expect(
      service.createSession({
        sessionId: "ss-2",
        gameId: "unknown",
        gameVersion: "0.0.1",
        seed: "seed-1",
        players: ["p1", "p2"]
      })
    ).rejects.toThrow("game_not_registered");
  });

  test("returns session_not_found for unknown submit target", async () => {
    const service = makeService();

    const result = await service.submitAction({
      sessionId: "missing",
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: { placements: [] },
      clientActionId: "ca-2"
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("session_not_found");
  });

  test("recovers session from snapshot and action tail", async () => {
    const registry = new InMemoryGameRegistry();
    registry.register({
      gameId: "battleship",
      version: "0.1.0",
      definition: miniDefinition,
      module: new BattleshipModule()
    });
    const eventRepo = new InMemoryEventRepository();
    const sessionRepo = new InMemorySessionRepository();
    const snapshotRepo = new InMemorySnapshotRepository();

    const serviceA = new SessionService(registry, eventRepo, sessionRepo, snapshotRepo, 2);
    const meta = {
      sessionId: "ss-recover",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    };
    await serviceA.createSession(meta);

    await serviceA.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      clientActionId: "r1"
    });
    await serviceA.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 1,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }] }]
      },
      clientActionId: "r2"
    });
    await serviceA.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 2,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 0 },
      clientActionId: "r3"
    });

    const serviceB = new SessionService(registry, eventRepo, sessionRepo, snapshotRepo, 2);
    await serviceB.recoverSession(meta.sessionId);

    const recoveredView = serviceB.getPlayerView(meta.sessionId, "p1") as { phase: string };
    expect(recoveredView.phase).toBe("play");

    const recoveredAction = await serviceB.submitAction({
      sessionId: meta.sessionId,
      expectedSeq: 3,
      actorPlayerId: "p2",
      actionType: "fire",
      payload: { row: 0, col: 0 },
      clientActionId: "r4"
    });

    expect(recoveredAction.accepted).toBe(true);
    expect(recoveredAction.seq).toBe(4);
  });
});
