import { describe, expect, it, test } from "vitest";
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

  test.each([2, 3, 4])("places all catalog treasures with private unique assignments for %i players", (playerCount) => {
    const module = new LabyrinthModule();
    const state = module.initGame({
      sessionId: `catalog-${playerCount}`,
      gameId: "labyrinth",
      gameVersion: "0.1.0",
      seed: "catalog-seed",
      players: Array.from({ length: playerCount }, (_, index) => `p${index + 1}`),
      definition
    }).initialState;

    const publicTreasures = state.board.flat().flatMap((tile) => tile.objectiveId ? [tile.objectiveId] : []);
    const assignedTreasures = state.players.flatMap((player) => player.remainingObjectives.map((objective) => objective.id));
    expect(publicTreasures).toHaveLength(definition.objectiveCatalog.length);
    expect(new Set(publicTreasures)).toEqual(new Set(definition.objectiveCatalog));
    expect(assignedTreasures).toHaveLength(playerCount * definition.objectivesPerPlayer);
    expect(new Set(assignedTreasures).size).toBe(assignedTreasures.length);
    expect(publicTreasures.length - assignedTreasures.length).toBe(24 - playerCount * 3);
  });

  test("rotation and insertion are legal during insertion stage", () => {
    const { module, state } = initState();
    const legal = module.listLegalActions(state, "p1");
    expect(legal.map((it) => it.actionType)).toEqual(["rotate_spare", "insert_tile"]);
  });

  test("rotates the spare tile without advancing the turn", () => {
    const { module, state } = initState();
    const before = state.spareTile;
    const rotationDeg = ((before.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270;

    const result = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "rotate_spare",
      payload: { rotationDeg },
      state,
      seed: "seed-1"
    });

    expect(result.accepted).toBe(true);
    expect(result.nextState.spareTile.rotationDeg).toBe(rotationDeg);
    expect(result.nextState.spareTile.openings).not.toEqual(before.openings);
    expect(result.nextState.turnStage).toBe("insert");
    expect(result.nextState.currentPlayerId).toBe("p1");
    expect(result.emittedEvents).toEqual([{ eventType: "spare.rotated", payload: { rotationDeg } }]);
  });

  test("rejects invalid spare rotations and rotations after insertion", () => {
    const { module, state } = initState();
    const invalid = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "rotate_spare",
      payload: { rotationDeg: 45 },
      state,
      seed: "seed-1"
    });
    expect(invalid.accepted).toBe(false);
    expect(invalid.reason).toBe("invalid_rotation");
    expect(invalid.nextState).toEqual(state);

    const inserted = module.applyAction({
      sessionId: "lab-1",
      seq: 0,
      actorPlayerId: "p1",
      actionType: "insert_tile",
      payload: { edge: "top", index: 1 },
      state,
      seed: "seed-1"
    });
    const late = module.applyAction({
      sessionId: "lab-1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "rotate_spare",
      payload: { rotationDeg: 90 },
      state: inserted.nextState,
      seed: "seed-1"
    });
    expect(late.accepted).toBe(false);
    expect(late.reason).toBe("unexpected_turn_stage");
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

  test("collects objective and can terminate after returning home", async () => {
    const { module, state } = initState();
    const mut = state;

    const p1 = mut.players.find((p) => p.playerId === "p1");
    expect(p1).toBeDefined();
    if (!p1) return;

    const objective = p1.remainingObjectives[0];
    expect(objective).toBeDefined();
    if (!objective) return;
    const { findObjectiveTile } = await import("../../../packages/games/labyrinth/src/rules/board");
    const objectivePos = findObjectiveTile(mut.board, objective.id);
    expect(objectivePos).not.toBeNull();

    p1.position = { ...objectivePos! };

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
      payload: findObjectiveTile(inserted.nextState.board, objective.id) ?? { row: -1, col: -1 },
      state: inserted.nextState,
      seed: "seed-1"
    });
    expect(collect.accepted).toBe(true);

    const afterCollectP1 = collect.nextState.players.find((p) => p.playerId === "p1");
    expect(afterCollectP1?.remainingObjectives.length).toBe(Math.max(0, p1.remainingObjectives.length - 1));
    expect(afterCollectP1?.collectedObjectiveIds).toContain(objective.id);
    expect(collect.nextState.board.flat().some((tile) => tile.objectiveId === objective.id)).toBe(false);

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

  test("player view reveals only the current private objective", () => {
    const { module, state } = initState();
    const view = module.getPlayerView({ state, playerId: "p1" }).visibleState as {
      players: Array<{ playerId: string; remainingObjectives?: unknown[]; objectivesRemainingCount: number }>;
      myState: {
        remainingObjectives?: unknown[];
        currentObjective: { id: string; position: { row: number; col: number } | null } | null;
        objectivesRemainingCount: number;
      };
    };

    const p2 = view.players.find((p) => p.playerId === "p2");
    expect(p2?.remainingObjectives).toBeUndefined();
    expect(typeof p2?.objectivesRemainingCount).toBe("number");
    expect(view.myState.remainingObjectives).toBeUndefined();
    expect(view.myState.currentObjective?.id).toBe(state.players[0]?.remainingObjectives[0]?.id);
    expect(view.myState.objectivesRemainingCount).toBe(state.players[0]?.remainingObjectives.length);
  });
});

describe("fixed tiles are never sealed", () => {
  it("corners open inward and every static tile connects into the board, across seeds", () => {
    const mod = new LabyrinthModule();
    for (const seed of ["a", "b", "c", "unlucky", "0263DF-seed"]) {
      const state = mod.initGame({
        sessionId: `fixed-${seed}`,
        gameId: "labyrinth",
        gameVersion: "0.1.0",
        seed,
        players: ["p1", "p2"],
        definition: definition as never
      }).initialState;

      const { rows, cols, insertionIndexes } = state.config;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (insertionIndexes.includes(row) || insertionIndexes.includes(col)) continue;
          const tile = state.board[row]![col]!;
          // no opening may face off-board on a tile that can never move
          if (row === 0) expect(tile.openings.N, `seed ${seed} (${row},${col})`).toBe(false);
          if (row === rows - 1) expect(tile.openings.S).toBe(false);
          if (col === 0) expect(tile.openings.W).toBe(false);
          if (col === cols - 1) expect(tile.openings.E).toBe(false);
          const inboard = Object.values(tile.openings).filter(Boolean).length;
          expect(inboard, `sealed static tile at ${row},${col} seed ${seed}`).toBeGreaterThanOrEqual(2);
        }
      }
      // homes specifically: corner tiles open exactly into the board
      expect(state.board[0]![0]!.openings).toMatchObject({ S: true, E: true, N: false, W: false });
      expect(state.board[rows - 1]![cols - 1]!.openings).toMatchObject({ N: true, W: true, S: false, E: false });
    }
  });
});

describe("findPath", () => {
  it("returns the shortest corridor path, null when blocked", async () => {
    const { findPath } = await import("../../../packages/games/labyrinth/src/rules/board");
    const open = { N: true, E: true, S: true, W: true };
    const closed = { N: false, E: false, S: false, W: false };
    const tile = (o: typeof open) => ({ id: "t", shape: "tee" as const, rotationDeg: 0 as const, openings: o, objectiveId: null });
    const config = { rows: 2, cols: 3, insertionIndexes: [1], objectivesPerPlayer: 1 };
    const board = [
      [tile(open), tile(open), tile(open)],
      [tile(open), tile(closed), tile(open)]
    ];
    expect(findPath(board, config, { row: 0, col: 0 }, { row: 0, col: 2 })).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }
    ]);
    expect(findPath(board, config, { row: 0, col: 0 }, { row: 1, col: 1 })).toBeNull();
  });
});

describe("objectives are tiles, not coordinates", () => {
  it("an ejected-and-reinserted objective tile is collectable where the TILE is", async () => {
    const { findObjectiveTile } = await import("../../../packages/games/labyrinth/src/rules/board");
    const module = new LabyrinthModule();
    let state = module.initGame({
      sessionId: "tile-obj", gameId: "labyrinth", gameVersion: "0.1.0",
      seed: "eject-seed", players: ["p1", "p2"], definition: definition as never
    }).initialState;

    const objective = state.players[0]!.remainingObjectives[0]!;
    // force the objective onto a shiftable lane's edge so one insertion ejects it
    const pos = findObjectiveTile(state.board, objective.id)!;
    const tile = state.board[pos.row]![pos.col]!;
    state.board[pos.row]![pos.col] = { ...tile, objectiveId: null };
    state.board[6]![1] = { ...state.board[6]![1]!, objectiveId: objective.id };

    // insert from top of column 1: the objective tile at row 6 is ejected to spare
    state = module.applyAction({
      sessionId: "tile-obj", seq: 0, actorPlayerId: "p1", actionType: "insert_tile",
      payload: { edge: "top", index: 1 }, state, seed: "eject-seed"
    }).nextState;
    expect(state.spareTile.objectiveId).toBe(objective.id);
    expect(findObjectiveTile(state.board, objective.id)).toBeNull();
  });
});

describe("placements: play continues after the first finisher", () => {
  it("ranks finishers and ends only when one player remains", () => {
    const module = new LabyrinthModule();
    const open = { N: true, E: true, S: true, W: true };
    let state = module.initGame({
      sessionId: "rank", gameId: "labyrinth", gameVersion: "0.1.0",
      seed: "rank-seed", players: ["p1", "p2", "p3"], definition: definition as never
    }).initialState;
    state.board = state.board.map((row, r) =>
      row.map((_, c) => ({ id: `o${r}-${c}`, shape: "tee" as const, rotationDeg: 0 as const, openings: open, objectiveId: null })));
    state.spareTile = { id: "sp", shape: "tee", rotationDeg: 0, openings: open, objectiveId: null };
    for (const p of state.players) p.remainingObjectives = [];

    const turn = (pid: string, dest: { row: number; col: number }) => {
      let r = module.applyAction({ sessionId: "rank", seq: 0, actorPlayerId: pid, actionType: "insert_tile", payload: { edge: "top", index: state.lastInsertion?.edge === "bottom" && state.lastInsertion.index === 1 ? 3 : 1 }, state, seed: "rank-seed" });
      expect(r.accepted).toBe(true);
      state = r.nextState;
      r = module.applyAction({ sessionId: "rank", seq: 1, actorPlayerId: pid, actionType: "move_pawn", payload: dest, state, seed: "rank-seed" });
      expect(r.accepted).toBe(true);
      state = r.nextState;
    };

    // p1 goes home: finished 1st, game continues
    turn("p1", state.players[0]!.home);
    expect(state.finishOrder).toEqual(["p1"]);
    expect(state.phase).toBe("play");
    expect(state.currentPlayerId).toBe("p2");
    expect(module.listLegalActions(state, "p1")).toHaveLength(0);

    // p2 goes home: finished 2nd -> only p3 left -> terminal, full ranking
    turn("p2", state.players[1]!.home);
    expect(state.phase).toBe("terminal");
    expect(state.finishOrder).toEqual(["p1", "p2", "p3"]);
    expect(module.isTerminal(state)?.winnerPlayerId).toBe("p1");
  });
});
