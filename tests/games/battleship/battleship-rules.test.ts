import { describe, expect, test } from "vitest";
import { BattleshipModule } from "@board-game-sim/battleship";
import definition from "../../../packages/games/battleship/definition.json";

const players = ["p1", "p2"];

const miniDefinition = {
  ...definition,
  ships: [{ id: "destroyer", size: 2 }]
};

function fullPlacements(startRow: number) {
  return [
    {
      shipId: "carrier",
      cells: [
        { row: startRow + 0, col: 0 },
        { row: startRow + 0, col: 1 },
        { row: startRow + 0, col: 2 },
        { row: startRow + 0, col: 3 },
        { row: startRow + 0, col: 4 }
      ]
    },
    {
      shipId: "battleship",
      cells: [
        { row: startRow + 1, col: 0 },
        { row: startRow + 1, col: 1 },
        { row: startRow + 1, col: 2 },
        { row: startRow + 1, col: 3 }
      ]
    },
    {
      shipId: "cruiser",
      cells: [
        { row: startRow + 2, col: 0 },
        { row: startRow + 2, col: 1 },
        { row: startRow + 2, col: 2 }
      ]
    },
    {
      shipId: "submarine",
      cells: [
        { row: startRow + 3, col: 0 },
        { row: startRow + 3, col: 1 },
        { row: startRow + 3, col: 2 }
      ]
    },
    {
      shipId: "destroyer",
      cells: [
        { row: startRow + 4, col: 0 },
        { row: startRow + 4, col: 1 }
      ]
    }
  ];
}

function makeState(gameDefinition = definition) {
  return new BattleshipModule().initGame({
    sessionId: "s1",
    gameId: "battleship",
    gameVersion: "0.1.0",
    seed: "seed-1",
    players,
    definition: gameDefinition
  }).initialState;
}

describe("battleship rules", () => {
  test("rejects out-of-bounds placement", () => {
    const module = new BattleshipModule();
    const placements = fullPlacements(0);
    placements[4] = {
      shipId: "destroyer",
      cells: [{ row: -1, col: 0 }, { row: -1, col: 1 }]
    };

    const result = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: { placements },
      state: makeState(),
      seed: "seed-1"
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("placement_out_of_bounds");
  });

  test("rejects invalid ship shape and missing ship set", () => {
    const module = new BattleshipModule();

    const missingSet = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: {
        placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      state: makeState(),
      seed: "seed-1"
    });
    expect(missingSet.accepted).toBe(false);
    expect(missingSet.reason).toBe("invalid_ship_set");

    const badShape = fullPlacements(0);
    badShape[4] = {
      shipId: "destroyer",
      cells: [{ row: 4, col: 0 }, { row: 5, col: 1 }]
    };

    const shapeResult = module.applyAction({
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: { placements: badShape },
      state: makeState(),
      seed: "seed-1"
    });

    expect(shapeResult.accepted).toBe(false);
    expect(shapeResult.reason).toBe("invalid_ship_shape");
  });

  test("enforces turn order during play", () => {
    const module = new BattleshipModule();
    let state = makeState();

    state = module.applyAction({
      sessionId: "s1",
      seq: 1,
      actorPlayerId: "p1",
      actionType: "place_ships",
      payload: { placements: fullPlacements(0) },
      state,
      seed: "seed-1"
    }).nextState;

    state = module.applyAction({
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p2",
      actionType: "place_ships",
      payload: { placements: fullPlacements(5) },
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
    let state = makeState(miniDefinition);

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
    expect(winning.emittedEvents.some((event) => event.eventType === "ship.sunk")).toBe(true);
  });

  test("duplicate shot is rejected", () => {
    const module = new BattleshipModule();
    let state = makeState(miniDefinition);

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

    const duplicate = module.applyAction({
      sessionId: "s1",
      seq: 5,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 0 },
      state,
      seed: "seed-1"
    });

    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toBe("duplicate_shot");
  });

  test("player view hides unsunk opponent ship cells", () => {
    const module = new BattleshipModule();
    let state = makeState(miniDefinition);

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

    const viewBeforeSunk = module.getPlayerView({ state, playerId: "p1" }).visibleState as {
      opponentBoard: { sunkShips: Array<{ shipId: string }> };
    };
    expect(viewBeforeSunk.opponentBoard.sunkShips).toHaveLength(0);

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

    state = module.applyAction({
      sessionId: "s1",
      seq: 5,
      actorPlayerId: "p1",
      actionType: "fire",
      payload: { row: 1, col: 1 },
      state,
      seed: "seed-1"
    }).nextState;

    const viewAfterSunk = module.getPlayerView({ state, playerId: "p1" }).visibleState as {
      opponentBoard: { sunkShips: Array<{ shipId: string }> };
    };
    expect(viewAfterSunk.opponentBoard.sunkShips).toHaveLength(1);
  });
});
