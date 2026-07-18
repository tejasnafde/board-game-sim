import { describe, expect, it } from "vitest";
import { Connect4Module, connect4Bot, type Connect4State } from "@board-game-sim/connect4";
import definition from "../../../packages/games/connect4/definition.json";

const mod = new Connect4Module();

function freshState(): Connect4State {
  return mod.initGame({
    sessionId: "t",
    gameId: "connect4",
    gameVersion: "0.1.0",
    seed: "seed",
    players: ["a", "b"],
    definition: definition as never
  }).initialState;
}

function drop(state: Connect4State, playerId: string, col: number) {
  return mod.applyAction({
    sessionId: "t",
    seq: 0,
    actorPlayerId: playerId,
    actionType: "drop",
    payload: { col },
    state,
    seed: "seed"
  });
}

describe("connect4 rules", () => {
  it("stacks discs with gravity and alternates turns", () => {
    let state = freshState();
    let result = drop(state, "a", 3);
    expect(result.accepted).toBe(true);
    state = result.nextState;
    expect(state.grid[5]![3]).toBe("a");
    expect(state.currentPlayerId).toBe("b");

    result = drop(state, "b", 3);
    state = result.nextState;
    expect(state.grid[4]![3]).toBe("b");
  });

  it("rejects illegal actions safely", () => {
    const state = freshState();
    expect(drop(state, "b", 0).reason).toBe("not_your_turn");
    expect(drop(state, "a", 9).reason).toBe("column_out_of_bounds");
    expect(drop(state, "a", -1).reason).toBe("column_out_of_bounds");

    let s = state;
    for (let i = 0; i < 6; i += 1) {
      s = drop(s, s.currentPlayerId, 0).nextState;
    }
    expect(drop(s, s.currentPlayerId, 0).reason).toBe("column_full");
  });

  it("detects a vertical win and terminal state", () => {
    let s = freshState();
    // a: col 0 x4, b: col 6 x3
    for (const col of [0, 6, 0, 6, 0, 6]) {
      s = drop(s, s.currentPlayerId, col).nextState;
    }
    const result = drop(s, "a", 0);
    expect(result.accepted).toBe(true);
    expect(result.nextState.phase).toBe("terminal");
    expect(result.nextState.winningCells).toHaveLength(4);
    expect(mod.isTerminal(result.nextState)).toMatchObject({ winnerPlayerId: "a" });
    expect(drop(result.nextState, "b", 1).reason).toBe("terminal_state");
  });

  it("detects a diagonal win", () => {
    let s = freshState();
    // Build a / diagonal for "a": cols 0,1,2,3 at increasing heights.
    for (const col of [0, 1, 1, 2, 2, 3, 2, 3, 3, 5, 3]) {
      s = drop(s, s.currentPlayerId, col).nextState;
    }
    expect(s.phase).toBe("terminal");
    expect(s.winnerPlayerId).toBe("a");
  });

  it("is deterministic: same moves → same integrity hash", () => {
    const play = () => {
      let s = freshState();
      let hash = "";
      for (const col of [3, 3, 2, 4, 1]) {
        const r = drop(s, s.currentPlayerId, col);
        s = r.nextState;
        hash = r.integrityHash;
      }
      return hash;
    };
    expect(play()).toBe(play());
  });
});

describe("connect4 bot", () => {
  it("takes an immediate win", () => {
    let s = freshState();
    for (const col of [0, 6, 0, 6, 0, 6]) {
      s = drop(s, s.currentPlayerId, col).nextState;
    }
    // a has three in column 0 and moves next.
    const action = connect4Bot({ view: s as never, definition: definition as never, playerId: "a", rng: () => 0.5 });
    expect(action).toMatchObject({ actionType: "drop", payload: { col: 0 } });
  });

  it("blocks an opponent's immediate win", () => {
    let s = freshState();
    // a threatens col 0 (three stacked); b must block.
    for (const col of [0, 6, 0, 5, 0]) {
      s = drop(s, s.currentPlayerId, col).nextState;
    }
    const action = connect4Bot({ view: s as never, definition: definition as never, playerId: "b", rng: () => 0.5 });
    expect(action).toMatchObject({ payload: { col: 0 } });
  });

  it("returns null off-turn", () => {
    const s = freshState();
    expect(connect4Bot({ view: s as never, definition: definition as never, playerId: "b", rng: () => 0.5 })).toBeNull();
  });
});
