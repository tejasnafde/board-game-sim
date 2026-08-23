import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HexKingdomsModule, type HexKingdomsView } from "@board-game-sim/hex-kingdoms";
import { HexKingdomsGameView } from "../../packages/web-client/src/game-adapters/hex-kingdoms/game-view";
import definition from "../../packages/games/hex-kingdoms/definition.json";

function view(): HexKingdomsView {
  const module = new HexKingdomsModule();
  const state = module.initGame({
    sessionId: "hex-ui",
    gameId: "hex-kingdoms",
    gameVersion: "0.1.0",
    seed: "hex-ui-seed",
    players: ["player-1", "player-2"],
    definition
  }).initialState;
  return module.getPlayerView({ state, playerId: state.currentPlayerId }).visibleState as unknown as HexKingdomsView;
}

function render(input: {
  state?: HexKingdomsView;
  selectedTileId?: string | null;
  tableReady?: boolean;
} = {}) {
  const state = input.state ?? view();
  return renderToStaticMarkup(<HexKingdomsGameView
    view={state}
    table={{ humanSeats: 1, botSeats: 1, claimedHumanSeats: input.tableReady === false ? 0 : 1, ready: input.tableReady !== false }}
    mySeat={state.youPlayerId}
    seatNames={{ "player-1": "Alexandria Verylongname", "player-2": "Computer" }}
    selectedTileId={input.selectedTileId ?? null}
    pending={false}
    onSelectTile={() => {}}
    onPlace={() => {}}
    onRematch={() => {}}
  />);
}

describe("Hex Kingdoms React game view", () => {
  test("renders the tactile map, market, scores, names, and current turn", () => {
    const state = view();
    const html = render({ state });

    expect(html).toContain("Hex Kingdoms");
    expect(html).toContain("Alexandria Verylongname");
    expect(html).toContain("Computer");
    expect(html).toContain('aria-label="Kingdom map"');
    expect(html.match(/hk-market-card/g)).toHaveLength(4);
    expect(html).toContain("Crownlands");
    expect(html).toContain(`${state.turnIndex + 1} / ${state.turnsTotal}`);
    expect(html).toContain("Choose a tile");
  });

  test("enables only listed legal spaces after selecting a market tile", () => {
    const state = view();
    const html = render({ state, selectedTileId: state.market[0]!.id });

    expect(html).toContain("Place on a highlighted frontier hex");
    expect(html.match(/hex-board__cell is-legal/g)).toHaveLength(state.legalCoordinates.length);
    expect(html).not.toContain("hex-board__cell is-selected-tile");
  });

  test("keeps gameplay disabled while reserved humans are missing", () => {
    const html = render({ tableReady: false });
    expect(html).toContain("Waiting for 1 more player");
    expect(html.match(/hk-market-card[^>]*disabled/g)).toHaveLength(4);
  });

  test("renders shared victory and rematch without hiding the final board", () => {
    const state = {
      ...view(),
      phase: "terminal" as const,
      winnerPlayerIds: ["player-1", "player-2"],
      winnerPlayerId: null
    };
    const html = render({ state });

    expect(html).toContain("Shared victory");
    expect(html).toContain("Play Again");
    expect(html).toContain('aria-label="Kingdom map"');
  });
});
