import { describe, expect, test } from "vitest";
import {
  createAssetPackRegistry,
  type AssetPack
} from "../../packages/web-client/src/asset-pack";

function pack(packId = "sea-command"): AssetPack {
  return {
    gameId: "battleship",
    packId,
    version: "1.0.0",
    roles: {
      "piece.carrier": {
        path: "ships/carrier.png",
        kind: "image",
        sourceId: "sea-warfare",
        nativeFacing: "north",
        fit: "contain"
      },
      "effect.shot.hit": {
        path: "effects/hit.png",
        kind: "image",
        sourceId: "sea-warfare"
      }
    },
    theme: {
      "--game-board": "#08223c"
    },
    sources: [{
      id: "sea-warfare",
      license: "CC0-1.0",
      author: "Lowder2",
      sourceUrl: "https://opengameart.org/content/sea-warfare-set-ships-and-more"
    }]
  };
}

const assetUrlByPath = {
  "ships/carrier.png": "/assets/carrier.hash.png",
  "effects/hit.png": "/assets/hit.hash.png"
};

describe("asset pack registry", () => {
  test("resolves semantic roles with render and license metadata", () => {
    const registry = createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack()],
      defaultPackId: "sea-command",
      requiredRoles: ["piece.carrier", "effect.shot.hit"],
      assetUrlByPath
    });
    const resolver = registry.select();

    expect(resolver.resolve("piece.carrier")).toMatchObject({
      url: "/assets/carrier.hash.png",
      nativeFacing: "north",
      fit: "contain",
      source: { license: "CC0-1.0", author: "Lowder2" }
    });
    expect(resolver.themeVariables()).toEqual({ "--game-board": "#08223c" });
    expect(resolver.credits()).toEqual([{
      license: "CC0-1.0",
      author: "Lowder2",
      sourceUrl: "https://opengameart.org/content/sea-warfare-set-ships-and-more"
    }]);
  });

  test("falls back to the default pack when a stored selection is unavailable", () => {
    const registry = createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack(), pack("classic-vector")],
      defaultPackId: "sea-command",
      requiredRoles: ["piece.carrier"],
      assetUrlByPath
    });

    expect(registry.select("missing").packId).toBe("sea-command");
    expect(registry.select("classic-vector").packId).toBe("classic-vector");
  });

  test("rejects roles that are not provided by the selected pack", () => {
    const registry = createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack()],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    });

    expect(() => registry.select().resolve("piece.destroyer"))
      .toThrow("asset_role_not_found:sea-command:piece.destroyer");
  });

  test("rejects packs that do not satisfy required roles", () => {
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack()],
      defaultPackId: "sea-command",
      requiredRoles: ["piece.destroyer"],
      assetUrlByPath
    })).toThrow("missing_asset_role:sea-command:piece.destroyer");
  });

  test("rejects duplicate pack IDs and unknown sources", () => {
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack(), pack()],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("duplicate_asset_pack:sea-command");

    const invalid = pack();
    invalid.roles["piece.carrier"] = {
      ...invalid.roles["piece.carrier"],
      sourceId: "missing"
    };
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [invalid],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("unknown_asset_source:sea-command:missing");
  });

  test("rejects referenced files that were not emitted by the build", () => {
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack()],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath: {}
    })).toThrow("asset_file_not_found:sea-command:ships/carrier.png");
  });

  test("rejects incomplete and duplicate source records", () => {
    const unlicensed = pack();
    unlicensed.sources[0].license = "";
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [unlicensed],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("invalid_asset_source:sea-command:sea-warfare");

    const duplicateSource = pack();
    duplicateSource.sources.push({ ...duplicateSource.sources[0] });
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [duplicateSource],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("duplicate_asset_source:sea-command:sea-warfare");
  });

  test("rejects packs registered for a different game", () => {
    const invalid = pack();
    invalid.gameId = "labyrinth";

    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [invalid],
      defaultPackId: "sea-command",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("asset_pack_game_mismatch:sea-command:labyrinth");
  });

  test("rejects an unavailable default pack", () => {
    expect(() => createAssetPackRegistry({
      gameId: "battleship",
      packs: [pack()],
      defaultPackId: "missing",
      requiredRoles: [],
      assetUrlByPath
    })).toThrow("default_asset_pack_not_found:missing");
  });
});
