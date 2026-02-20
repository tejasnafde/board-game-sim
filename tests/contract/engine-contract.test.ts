import { describe, expect, test } from "vitest";
import { SessionRuntime } from "@board-game-sim/engine/runtime";
import { InMemoryEventRepository, InMemorySnapshotRepository } from "@board-game-sim/engine/store";
import { BattleshipModule } from "@board-game-sim/battleship";
import definition from "../../packages/games/battleship/definition.json";

const players = ["p1", "p2"];

function placements(playerOffset = 0) {
  return {
    placements: [
      {
        shipId: "destroyer",
        cells: [
          { row: playerOffset, col: 0 },
          { row: playerOffset, col: 1 }
        ]
      }
    ]
  };
}

describe("engine contract", () => {
  test("determinism: same seed + actions yields same hash", async () => {
    const first = new SessionRuntime(new BattleshipModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    const second = new SessionRuntime(new BattleshipModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());

    await first.initSession(
      {
        sessionId: "s1",
        gameId: "battleship",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    await second.initSession(
      {
        sessionId: "s2",
        gameId: "battleship",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    await first.submitAction({
      sessionId: "s1",
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: placements(0),
      clientActionId: "a1"
    });
    await first.submitAction({
      sessionId: "s1",
      expectedSeq: 1,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: placements(1),
      clientActionId: "a2"
    });

    await second.submitAction({
      sessionId: "s2",
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: placements(0),
      clientActionId: "a1"
    });
    await second.submitAction({
      sessionId: "s2",
      expectedSeq: 1,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: placements(1),
      clientActionId: "a2"
    });

    expect(first.getSession("s1")?.integrityHash).toEqual(second.getSession("s2")?.integrityHash);
  });

  test("sequence guard rejects stale actions", async () => {
    const runtime = new SessionRuntime(new BattleshipModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    await runtime.initSession(
      {
        sessionId: "s3",
        gameId: "battleship",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    const stale = await runtime.submitAction({
      sessionId: "s3",
      expectedSeq: 2,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: placements(0),
      clientActionId: "stale"
    });

    expect(stale.accepted).toBe(false);
    expect(stale.reason).toBe("stale_sequence");
  });

  test("terminal freeze rejects follow-up actions", async () => {
    const runtime = new SessionRuntime(new BattleshipModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    await runtime.initSession(
      {
        sessionId: "s4",
        gameId: "battleship",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    await runtime.submitAction({ sessionId: "s4", expectedSeq: 0, actorPlayerId: "p1", actionType: "place_ships", payload: placements(0), clientActionId: "b1" });
    await runtime.submitAction({ sessionId: "s4", expectedSeq: 1, actorPlayerId: "p2", actionType: "place_ships", payload: placements(1), clientActionId: "b2" });

    await runtime.submitAction({ sessionId: "s4", expectedSeq: 2, actorPlayerId: "p1", actionType: "fire", payload: { row: 1, col: 0 }, clientActionId: "b3" });
    await runtime.submitAction({ sessionId: "s4", expectedSeq: 3, actorPlayerId: "p2", actionType: "fire", payload: { row: 0, col: 0 }, clientActionId: "b4" });
    await runtime.submitAction({ sessionId: "s4", expectedSeq: 4, actorPlayerId: "p1", actionType: "fire", payload: { row: 1, col: 1 }, clientActionId: "b5" });

    const frozen = await runtime.submitAction({
      sessionId: "s4",
      expectedSeq: 5,
      actorPlayerId: "p2",
      actionType: "fire",
      payload: { row: 0, col: 1 },
      clientActionId: "b6"
    });

    expect(frozen.accepted).toBe(false);
    expect(frozen.reason).toBe("session_terminal");
  });

  test("redaction hides unsunk opponent ships", () => {
    const module = new BattleshipModule();
    const state = module.initGame({
      sessionId: "s5",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players,
      definition
    }).initialState;

    state.players[1].ships = [{ shipId: "destroyer", cells: [{ row: 5, col: 5 }, { row: 5, col: 6 }] }];

    const view = module.getPlayerView({ state, playerId: "p1" });
    const opponent = (view.visibleState as any).players.find((p: any) => p.playerId === "p2");

    expect(opponent.ships[0].cells).toEqual([]);
  });
});
