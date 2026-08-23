import { describe, expect, test } from "vitest";
import { createSeededRng } from "@board-game-sim/shared";
import {
  HexKingdomsModule,
  hexKingdomsBot,
  hexKingdomsBotStance,
  type HexKingdomsView,
  type HexPlacement,
  type HexTile
} from "@board-game-sim/hex-kingdoms";
import definition from "../../../packages/games/hex-kingdoms/definition.json";

const module = new HexKingdomsModule();

function initialView(players = ["p1", "p2"]): HexKingdomsView {
  const state = module.initGame({
    sessionId: "hex-bot",
    gameId: "hex-kingdoms",
    gameVersion: "0.1.0",
    seed: "hex-bot-seed",
    players,
    definition
  }).initialState;
  return module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
}

function action(view: HexKingdomsView, seed = "bot-choice") {
  return hexKingdomsBot({
    view: view as never,
    definition,
    playerId: view.youPlayerId,
    rng: createSeededRng(seed)
  });
}

function tile(id: string, terrain: HexTile["terrain"]): HexTile {
  return { id, terrain, feature: "plain" };
}

function placed(
  tileId: string,
  ownerPlayerId: string,
  q: number,
  r: number,
  terrain: HexPlacement["terrain"]
): HexPlacement {
  return { tileId, ownerPlayerId, coordinate: { q, r }, terrain, feature: "plain" };
}

describe("Hex Kingdoms bot", () => {
  test("returns null off turn and at terminal", () => {
    const view = initialView();
    expect(hexKingdomsBot({ view: { ...view, currentPlayerId: "other" } as never, definition, playerId: view.youPlayerId, rng: () => 0 })).toBeNull();
    expect(hexKingdomsBot({ view: { ...view, phase: "terminal" } as never, definition, playerId: view.youPlayerId, rng: () => 0 })).toBeNull();
  });

  test("always chooses a visible market tile and listed legal coordinate", () => {
    const view = initialView(["p1", "p2", "p3", "p4"]);
    const chosen = action(view);

    expect(chosen?.actionType).toBe("draft_and_place");
    const payload = chosen?.payload as { marketTileId: string; q: number; r: number };
    expect(view.market.map((item) => item.id)).toContain(payload.marketTileId);
    expect(view.legalCoordinates).toContainEqual({ q: payload.q, r: payload.r });
  });

  test("reconnects a detached expedition when that creates the strongest score", () => {
    const view = initialView();
    const playerId = view.youPlayerId;
    const custom: HexKingdomsView = {
      ...view,
      capitals: { ...view.capitals, [playerId]: { q: -3, r: 0 } },
      market: [tile("bridge", "meadow")],
      placements: [
        placed("home", playerId, -2, 0, "forest"),
        placed("expedition", playerId, 0, -1, "water")
      ],
      legalCoordinates: [{ q: -1, r: 0 }, { q: 2, r: 1 }]
    };

    expect(action(custom)?.payload).toMatchObject({ q: -1, r: 0 });
  });

  test("prefers a move that wins a landmark plurality", () => {
    const view = initialView();
    const playerId = view.youPlayerId;
    const opponentId = view.players.find((id) => id !== playerId)!;
    const custom: HexKingdomsView = {
      ...view,
      market: [tile("landmark", "mountain")],
      placements: [
        placed("ours", playerId, -1, 0, "forest"),
        placed("theirs", opponentId, 1, 0, "forest")
      ],
      legalCoordinates: [{ q: 0, r: 1 }, { q: -2, r: 1 }]
    };

    expect(action(custom)?.payload).toMatchObject({ q: 0, r: 1 });
  });

  test("completes a diversity set over a redundant terrain", () => {
    const view = initialView();
    const playerId = view.youPlayerId;
    const custom: HexKingdomsView = {
      ...view,
      market: [tile("needed-water", "water"), tile("extra-forest", "forest")],
      placements: [
        placed("m", playerId, -2, 0, "meadow"),
        placed("f", playerId, -1, 0, "forest"),
        placed("n", playerId, -1, 1, "mountain")
      ],
      legalCoordinates: [{ q: 0, r: -1 }]
    };

    expect(action(custom)?.payload).toMatchObject({ marketTileId: "needed-water" });
  });

  test("uses stable stances and deterministic seeded tie resolution without mutation", () => {
    const view = initialView();
    const before = structuredClone(view);

    expect(["architect", "warden", "steward"]).toContain(hexKingdomsBotStance(view.youPlayerId));
    expect(hexKingdomsBotStance(view.youPlayerId)).toBe(hexKingdomsBotStance(view.youPlayerId));
    expect(action(view, "same-choice")).toEqual(action(view, "same-choice"));
    expect(view).toEqual(before);
  });
});
