import { describe, expect, test } from "vitest";
import { deterministicHash } from "@board-game-sim/shared";
import { LabyrinthModule } from "../../../packages/games/labyrinth/src/rules/labyrinth-module";
import definition from "../../../packages/games/labyrinth/definition.json";

const players = ["p1", "p2", "p3"];

function initState(seed = "seed-1") {
  const module = new LabyrinthModule();
  const init = module.initGame({
    sessionId: "lab-1",
    gameId: "labyrinth",
    gameVersion: "0.1.0",
    seed,
    players,
    definition
  });
  return { module, state: init.initialState, integrityHash: init.integrityHash };
}

describe("labyrinth rules", () => {
  test("determinism: same seed yields same initial hash", () => {
    const first = initState("same-seed");
    const second = initState("same-seed");

    expect(first.integrityHash).toBe(second.integrityHash);
    expect(deterministicHash(first.state)).toBe(deterministicHash(second.state));
  });

  test("only insert_tile is legal during insertion stage", () => {
    const { module, state } = initState();
    const legal = module.listLegalActions(state, "p1");
    expect(legal.map((it) => it.actionType)).toEqual(["insert_tile"]);
  });

  test("rejects insertion from illegal slot", () => {
    const { module, state } = initState();
    const result = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 0 },
      state,
      seed: "seed-1"
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("invalid_insertion_slot");
  });

  test("rejects immediate reverse insertion on next turn", () => {
    const { module, state } = initState();

    const inserted = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      state,
      seed: "seed-1"
    });
    expect(inserted.accepted).toBe(true);

    const moved = module.applyAction({
      sessionId: "lab-1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "move_pawn",
      payload: { row: 0, col: 0 },
      state: inserted.nextState,
      seed: "seed-1"
    });
    expect(moved.accepted).toBe(true);

    const reverse = module.applyAction({
      sessionId: "lab-1",
      seq: 2,
      actorPlayerId: "p2",
      actionType: "insert_tile",
      payload: { edge: "bottom", index: 1 },
      state: moved.nextState,
      seed: "seed-1"
    });
    expect(reverse.accepted).toBe(false);
    expect(reverse.reason).toBe("reverse_insertion_forbidden");
  });

  test("rejects unreachable move target", () => {
    const { module, state } = initState();

    const inserted = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      state,
      seed: "seed-1"
    });
    expect(inserted.accepted).toBe(true);

    const moved = module.applyAction({
      sessionId: "lab-1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "move_pawn",
      payload: { row: 6, col: 6 },
      state: inserted.nextState,
      seed: "seed-1"
    });

    expect(moved.accepted).toBe(false);
    expect(moved.reason).toBe("unreachable_destination");
  });

  test("collects objective and can terminate after returning home", () => {
    const { module, state } = initState();
    const mut = state;

    const p1 = mut.players.find((p) => p.playerId === "p1");
    expect(p1).toBeDefined();
    if (!p1) return;

    const objective = p1.remainingObjectives[0];
    expect(objective).toBeDefined();
    if (!objective) return;

    p1.position = { ...objective.position };

    const inserted = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      state: mut,
      seed: "seed-1"
    });
    expect(inserted.accepted).toBe(true);

    const collect = module.applyAction({
      sessionId: "lab-1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "move_pawn",
      payload: { row: objective.position.row, col: objective.position.col },
      state: inserted.nextState,
      seed: "seed-1"
    });
    expect(collect.accepted).toBe(true);

    const afterCollectP1 = collect.nextState.players.find((p) => p.playerId === "p1");
    expect(afterCollectP1?.remainingObjectives.length).toBe(Math.max(0, p1.remainingObjectives.length - 1));

    if ((afterCollectP1?.remainingObjectives.length ?? 1) === 0) {
      const backToP1 = {
        ...collect.nextState,
        currentPlayerId: "p1",
        turnStage: "insert" as const
      };
      const insert2 = module.applyAction({
        sessionId: "lab-1",
        seq: 2,
        actorPlayerId: "p1",
        actionType: "insert_tile",
        payload: { edge: "left", index: 1 },
        state: backToP1,
        seed: "seed-1"
      });
      expect(insert2.accepted).toBe(true);

      const home = module.applyAction({
        sessionId: "lab-1",
        seq: 3,
        actorPlayerId: "p1",
        actionType: "move_pawn",
        payload: {
          row: afterCollectP1?.home.row ?? 0,
          col: afterCollectP1?.home.col ?? 0
        },
        state: insert2.nextState,
        seed: "seed-1"
      });

      expect(home.nextState.phase).toBe("terminal");
      expect(home.nextState.winnerPlayerId).toBe("p1");
    }
  });

  test("player view hides opponents remaining objectives", () => {
    const { module, state } = initState();
    const view = module.getPlayerView({ state, playerId: "p1" }).visibleState as {
      players: Array<{ playerId: string; remainingObjectives?: unknown[]; objectivesRemainingCount: number }>;
      myState: { remainingObjectives: unknown[] };
    };

    const p2 = view.players.find((p) => p.playerId === "p2");
    expect(p2?.remainingObjectives).toBeUndefined();
    expect(typeof p2?.objectivesRemainingCount).toBe("number");
    expect(Array.isArray(view.myState.remainingObjectives)).toBe(true);
  });
});
