import { describe, expect, test } from "vitest";
import { BattleshipModule } from "@board-game-sim/battleship";
import definition from "../../../packages/games/battleship/definition.json";

const players = ["p1", "p2"];

function makeState() {
  return new BattleshipModule().initGame({
    sessionId: "s1",
    gameId: "battleship",
    gameVersion: "0.1.0",
    seed: "seed-1",
    players,
    definition
  }).initialState;
}

describe("battleship rules", () => {
  test("rejects out-of-bounds placement", () => {
    const module = new BattleshipModule();
    const result = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: -1, col: 0 }, { row: -1, col: 1 }] }]
      },
      state: makeState(),
      seed: "seed-1"
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("placement_out_of_bounds");
  });

  test("enforces turn order during play", () => {
    const module = new BattleshipModule();
    let state = makeState();

    state = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    const outOfTurn = module.applyAction({
      sessionId: "s1",
      seq: 3,
      actorPlayerId: "p2",
      actionType: "fire",
      payload: { row: 0, col: 0 },
      state,
      seed: "seed-1"
    });

    expect(outOfTurn.accepted).toBe(false);
    expect(outOfTurn.reason).toBe("not_your_turn");
  });

  test("fires and reaches terminal when all opponent cells are hit", () => {
    const module = new BattleshipModule();
    let state = makeState();

    state = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 3,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 0 },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 4,
      actorPlayerId: "p2",
      actionType: "fire",
      payload: { row: 0, col: 0 },
      state,
      seed: "seed-1"
    }).nextState;

    const winning = module.applyAction({
      sessionId: "s1",
      seq: 5,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 1 },
      state,
      seed: "seed-1"
    });

    expect(winning.accepted).toBe(true);
    expect(winning.nextState.phase).toBe("terminal");
    expect(winning.nextState.winnerPlayerId).toBe("p1");
  });

  test("duplicate shot is rejected", () => {
    const module = new BattleshipModule();
    let state = makeState();

    state = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }] }]
      },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 3,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 0 },
      state,
      seed: "seed-1"
    }).nextState;

    const duplicate = module.applyAction({
      sessionId: "s1",
      seq: 4,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 0 },
      state,
      seed: "seed-1"
    });

    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toBe("duplicate_shot");
  });
});
