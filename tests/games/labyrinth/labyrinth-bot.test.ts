import { describe, expect, it } from "vitest";
import { LabyrinthModule, labyrinthBot, type LabyrinthState, type Tile } from "@board-game-sim/labyrinth";
import definition from "../../../packages/games/labyrinth/definition.json";

const mod = new LabyrinthModule();

function openTile(id: string, objectiveId: string | null = null): Tile {
  return { id, shape: "tee", rotationDeg: 0, openings: { N: true, E: true, S: true, W: true }, objectiveId };
}

/** Real game state, then rewire the board to be fully open so paths are known. */
function openBoardState(): LabyrinthState {
  const state = mod.initGame({
    sessionId: "bot-t",
    gameId: "labyrinth",
    gameVersion: "0.1.0",
    seed: "bot-seed",
    players: ["me", "them"],
    definition: definition as never
  }).initialState;

  state.board = state.board.map((row, r) => row.map((_, c) => openTile(`t${r}-${c}`)));
  state.spareTile = openTile("spare");
  return state;
}

function viewFor(state: LabyrinthState, playerId: string) {
  return mod.getPlayerView({ state, playerId }).visibleState;
}

function act(state: LabyrinthState, playerId: string) {
  const action = labyrinthBot({
    view: viewFor(state, playerId) as never,
    definition: definition as never,
    playerId,
    rng: () => 0.5
  });
  if (!action) throw new Error("bot_passed");
  const result = mod.applyAction({
    sessionId: "bot-t",
    seq: 0,
    actorPlayerId: playerId,
    actionType: action.actionType,
    payload: action.payload as never,
    state,
    seed: "bot-seed"
  });
  expect(result.accepted, `bot move rejected: ${result.reason}`).toBe(true);
  return result.nextState;
}

describe("labyrinth bot quality bar", () => {
  it("takes the winning move: all objectives done → goes straight home", () => {
    let state = openBoardState();
    const me = state.players.find((p) => p.playerId === "me")!;
    me.remainingObjectives = [];
    me.position = { row: 3, col: 3 };

    state = act(state, "me"); // insert
    state = act(state, "me"); // move
    expect(state.phase).toBe("terminal");
    expect(state.winnerPlayerId).toBe("me");
  });

  it("collects its current objective when reachable", () => {
    let state = openBoardState();
    const me = state.players.find((p) => p.playerId === "me")!;
    me.position = { row: 3, col: 3 };
    me.remainingObjectives = [{ id: "gem", position: { row: 4, col: 4 } }];
    state.board[4]![4] = openTile("t4-4", "gem");

    state = act(state, "me");
    state = act(state, "me");
    const after = state.players.find((p) => p.playerId === "me")!;
    expect(after.collectedObjectiveIds).toContain("gem");
  });

  it("is deterministic and fast on a real board", () => {
    const state = mod.initGame({
      sessionId: "bot-d",
      gameId: "labyrinth",
      gameVersion: "0.1.0",
      seed: "det-seed",
      players: ["me", "them"],
      definition: definition as never
    }).initialState;

    const start = performance.now();
    const a = labyrinthBot({ view: viewFor(state, "me") as never, definition: definition as never, playerId: "me", rng: () => 0.5 });
    const elapsed = performance.now() - start;
    const b = labyrinthBot({ view: viewFor(state, "me") as never, definition: definition as never, playerId: "me", rng: () => 0.5 });

    expect(a).toEqual(b);
    expect(elapsed).toBeLessThan(100);
  });

  it("returns null off-turn", () => {
    const state = openBoardState();
    expect(
      labyrinthBot({ view: viewFor(state, "them") as never, definition: definition as never, playerId: "them", rng: () => 0.5 })
    ).toBeNull();
  });
});
