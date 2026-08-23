import { describe, expect, test } from "vitest";
import { gameCatalog } from "../../packages/web-client/src/registered-games";
import type { ClientEvent, ServerEvent } from "../../packages/web-client/src/realtime-client";

const transport = {
  send(_event: ClientEvent) {},
  subscribe(_listener: (event: ServerEvent) => void) {
    return () => {};
  }
};

describe("registered game clients", () => {
  test("all live catalog entries expose a playable client module", () => {
    expect(gameCatalog.listPlayable().every((entry) => entry.client)).toBe(true);
  });

  test("battleship owns its semantic renderer assets and two visual packs", () => {
    const entry = gameCatalog.resolvePlayable("battleship");
    const adapter = entry?.client?.createUiAdapter({ transport, baseAssetPath: "/" });
    const packs = entry?.client?.assetPacks;

    expect(packs?.list().map((pack) => pack.packId)).toEqual([
      "sea-command",
      "classic-vector"
    ]);
    expect(adapter?.runtime.renderer?.render({
      ownBoard: {
        rows: 1,
        cols: 2,
        ships: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      opponentBoard: { rows: 1, cols: 2 }
    })).toContain("destroyer.png");
  });

  test("battleship can swap visual packs without changing its game adapter", () => {
    const entry = gameCatalog.resolvePlayable("battleship");
    const adapter = entry?.client?.createUiAdapter({
      transport,
      baseAssetPath: "/",
      assetPackId: "classic-vector"
    });

    expect(adapter?.runtime.assets?.packId).toBe("classic-vector");
    expect(adapter?.runtime.renderer?.render({
      ownBoard: {
        rows: 1,
        cols: 2,
        ships: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
      },
      opponentBoard: { rows: 1, cols: 2 }
    })).toContain("destroyer.svg");
  });
});
