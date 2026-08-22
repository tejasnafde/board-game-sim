import { describe, expect, test } from "vitest";
import { SessionRuntime, InMemoryEventRepository, InMemorySnapshotRepository } from "@board-game-sim/engine";
import { LabyrinthModule } from "@board-game-sim/labyrinth";
import definition from "../../packages/games/labyrinth/definition.json";

const players = ["p1", "p2", "p3"];

describe("labyrinth contract", () => {
  test("supports session init and stale sequence guard", async () => {
    const runtime = new SessionRuntime(new LabyrinthModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    await runtime.initSession(
      {
        sessionId: "lab-c-1",
        gameId: "labyrinth",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    const stale = await runtime.submitAction({
      sessionId: "lab-c-1",
      expectedSeq: 2,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      clientActionId: "lab-a1"
    });

    expect(stale.accepted).toBe(false);
    expect(stale.reason).toBe("stale_sequence");
  });

  test("rejects actions after state is marked terminal", async () => {
    const runtime = new SessionRuntime(new LabyrinthModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    await runtime.initSession(
      {
        sessionId: "lab-c-2",
        gameId: "labyrinth",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    const state = runtime.getSession("lab-c-2")?.state as any;
    state.phase = "terminal";
    state.winnerPlayerId = "p1";

    const frozen = await runtime.submitAction({
      sessionId: "lab-c-2",
      expectedSeq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      clientActionId: "lab-a2"
    });

    expect(frozen.accepted).toBe(false);
    expect(frozen.reason).toBe("illegal_action");
  });

  test("getPlayerView redacts opponent private objectives", async () => {
    const runtime = new SessionRuntime(new LabyrinthModule(), new InMemoryEventRepository(), new InMemorySnapshotRepository());
    await runtime.initSession(
      {
        sessionId: "lab-c-3",
        gameId: "labyrinth",
        gameVersion: "0.1.0",
        seed: "seed-1",
        players
      },
      definition
    );

    const view = runtime.getPlayerView("lab-c-3", "p1") as {
      myState: { remainingObjectives?: unknown[]; currentObjective: { id: string } | null; objectivesRemainingCount: number };
      players: Array<{ playerId: string; remainingObjectives?: unknown[] }>;
    };

    expect(view.myState.remainingObjectives).toBeUndefined();
    expect(view.myState.currentObjective?.id).toBeTypeOf("string");
    expect(view.myState.objectivesRemainingCount).toBe(3);
    const p2 = view.players.find((p) => p.playerId === "p2");
    expect(p2?.remainingObjectives).toBeUndefined();
  });
});
