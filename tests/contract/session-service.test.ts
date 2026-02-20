import { describe, expect, test } from "vitest";
import { InMemoryEventRepository, InMemoryGameRegistry, InMemorySnapshotRepository } from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { SessionService } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

function makeService() {
  const registry = new InMemoryGameRegistry();
  registry.register({
    gameId: "battleship",
    version: "0.1.0",
    definition,
    module: new BattleshipModule()
  });

  return new SessionService(
    registry,
    new InMemoryEventRepository(),
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
});
