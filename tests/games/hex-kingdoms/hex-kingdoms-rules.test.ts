import { describe, expect, test } from "vitest";
import { axialKey, deterministicHash } from "@board-game-sim/shared";
import {
  HexKingdomsModule,
  scoreHexKingdoms,
  type HexKingdomsState,
  type HexKingdomsView
} from "@board-game-sim/hex-kingdoms";
import definition from "../../../packages/games/hex-kingdoms/definition.json";

const module = new HexKingdomsModule();

function initialize(players = ["p1", "p2"], seed = "hex-rules-seed") {
  return module.initGame({
    sessionId: `hex-${players.length}`,
    gameId: "hex-kingdoms",
    gameVersion: "0.1.0",
    seed,
    players,
    definition
  });
}

function placeFirstLegal(state: HexKingdomsState) {
  const view = module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
  return module.applyAction({
    sessionId: "hex-play",
    seq: state.turnIndex + 1,
    actorPlayerId: state.currentPlayerId,
    actionType: "draft_and_place",
    payload: {
      marketTileId: view.market[0]!.id,
      ...view.legalCoordinates[0]!
    },
    state,
    seed: "hex-rules-seed"
  });
}

describe("Hex Kingdoms rules", () => {
  test("initializes deterministically while different seeds vary private order or starter", () => {
    const first = initialize(["p1", "p2", "p3"], "same-seed");
    const second = initialize(["p1", "p2", "p3"], "same-seed");
    const varied = initialize(["p1", "p2", "p3"], "different-seed");

    expect(first.initialState).toEqual(second.initialState);
    expect(first.integrityHash).toBe(second.integrityHash);
    expect(first.emittedEvents).toEqual(second.emittedEvents);
    expect({ market: first.initialState.market, pile: first.initialState.drawPile, starter: first.initialState.currentPlayerId })
      .not.toEqual({ market: varied.initialState.market, pile: varied.initialState.drawPile, starter: varied.initialState.currentPlayerId });
    expect(first.initialState.market).toHaveLength(4);
  });

  test("exposes public state and actor-only legal coordinates without the private pile", () => {
    const state = initialize().initialState;
    const active = module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
    const inactiveId = state.players.find((playerId) => playerId !== state.currentPlayerId)!;
    const inactive = module.getPlayerView({ state, playerId: inactiveId }).visibleState as unknown as HexKingdomsView;
    const unknown = module.getPlayerView({ state, playerId: "spectator" }).visibleState as unknown as HexKingdomsView;

    expect(active.market).toEqual(state.market);
    expect(active.remainingTileCount).toBe(state.drawPile.length);
    expect(active.legalCoordinates.length).toBeGreaterThan(0);
    expect(inactive.legalCoordinates).toEqual([]);
    expect(unknown.legalCoordinates).toEqual([]);
    expect(JSON.stringify(active)).not.toContain("drawPile");
    expect(JSON.stringify(active)).not.toContain(state.drawPile[0]!.id);
  });

  test("accepts one atomic draft and placement, refills, scores, and advances", () => {
    const state = initialize().initialState;
    const priorMarketIds = state.market.map((tile) => tile.id);
    const priorPileLength = state.drawPile.length;
    const actor = state.currentPlayerId;
    const result = placeFirstLegal(state);

    expect(result.accepted).toBe(true);
    expect(result.nextState.turnIndex).toBe(1);
    expect(result.nextState.placements).toHaveLength(1);
    expect(result.nextState.placements[0]!.ownerPlayerId).toBe(actor);
    expect(priorMarketIds).toContain(result.nextState.placements[0]!.tileId);
    expect(result.nextState.market).toHaveLength(4);
    expect(result.nextState.drawPile).toHaveLength(priorPileLength - 1);
    expect(new Set([
      ...result.nextState.market.map((tile) => tile.id),
      ...result.nextState.drawPile.map((tile) => tile.id),
      ...result.nextState.placements.map((tile) => tile.tileId)
    ])).toHaveLength(48);
    expect(result.nextState.currentPlayerId).not.toBe(actor);
    expect(result.emittedEvents.map((event) => event.eventType)).toEqual([
      "tile.placed",
      "market.refilled",
      "scores.updated"
    ]);
    expect(result.nextState.scores).toEqual(scoreHexKingdoms({
      players: result.nextState.players,
      capitals: result.nextState.capitals,
      landmarks: result.nextState.landmarks,
      placements: result.nextState.placements,
      scoring: result.nextState.config.scoring
    }));
  });

  test("allows placement beside capitals, landmarks, and placed tiles", () => {
    let state = initialize().initialState;
    const activeView = module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
    const occupiedStatic = new Set([
      ...Object.values(state.capitals).map(axialKey),
      ...state.landmarks.map(axialKey)
    ]);
    expect(activeView.legalCoordinates.some((coordinate) => (
      state.landmarks.some((landmark) => Math.max(
        Math.abs(coordinate.q - landmark.q),
        Math.abs(coordinate.r - landmark.r),
        Math.abs(coordinate.q + coordinate.r - landmark.q - landmark.r)
      ) === 1)
    ))).toBe(true);
    expect(activeView.legalCoordinates.every((coordinate) => !occupiedStatic.has(axialKey(coordinate)))).toBe(true);

    const first = placeFirstLegal(state);
    state = first.nextState;
    const nextView = module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
    const placedAt = state.placements[0]!.coordinate;
    expect(nextView.legalCoordinates.some((coordinate) => Math.max(
      Math.abs(coordinate.q - placedAt.q),
      Math.abs(coordinate.r - placedAt.r),
      Math.abs(coordinate.q + coordinate.r - placedAt.q - placedAt.r)
    ) === 1)).toBe(true);
  });

  test.each([
    ["wrong actor", (state: HexKingdomsState) => ({ actor: "not-current", action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, q: 0, r: 1 } })],
    ["unknown action", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "pass", payload: {} })],
    ["malformed payload", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: null })],
    ["fractional coordinate", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, q: 0.5, r: 1 } })],
    ["unknown tile", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: "missing", q: 0, r: 1 } })],
    ["out of arena", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, q: 99, r: 99 } })],
    ["capital cell", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, ...state.capitals[state.currentPlayerId]! } })],
    ["landmark cell", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, ...state.landmarks[0]! } })],
    ["nonadjacent cell", (state: HexKingdomsState) => ({ actor: state.currentPlayerId, action: "draft_and_place", payload: { marketTileId: state.market[0]!.id, q: -2, r: 2 } })]
  ])("rejects %s without mutation", (_label, buildAction) => {
    const state = initialize().initialState;
    const before = structuredClone(state);
    const hash = deterministicHash(state);
    const action = buildAction(state);
    const result = module.applyAction({
      sessionId: "illegal",
      seq: 1,
      actorPlayerId: action.actor,
      actionType: action.action,
      payload: action.payload as never,
      state,
      seed: "hex-rules-seed"
    });

    expect(result.accepted).toBe(false);
    expect(result.nextState).toEqual(before);
    expect(state).toEqual(before);
    expect(result.integrityHash).toBe(hash);
    expect(result.emittedEvents).toEqual([]);
  });

  test.each([
    [["p1", "p2"], 20],
    [["p1", "p2", "p3"], 30],
    [["p1", "p2", "p3", "p4"], 40]
  ])("terminates a %s-seat game after the exact placement count", (players, expectedTurns) => {
    let state = initialize(players).initialState;
    for (let turn = 0; turn < expectedTurns; turn += 1) {
      expect(module.isTerminal(state)).toBeNull();
      const result = placeFirstLegal(state);
      expect(result.accepted, result.reason).toBe(true);
      state = result.nextState;
    }

    expect(state.turnIndex).toBe(expectedTurns);
    expect(state.placements).toHaveLength(expectedTurns);
    expect(state.phase).toBe("terminal");
    expect(module.isTerminal(state)?.reason).toBe("kingdoms_scored");
    const rejected = placeFirstLegal(state);
    expect(rejected.accepted).toBe(false);
    expect(rejected.nextState).toEqual(state);
  });
});
