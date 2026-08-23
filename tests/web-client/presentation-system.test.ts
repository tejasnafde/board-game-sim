import { describe, expect, test } from "vitest";
import presentation from "../../packages/games/battleship/presentation.json";
import hexPresentation from "../../packages/games/hex-kingdoms/presentation.json";
import { AssetManager } from "../../packages/web-client/src/asset-manager";
import { RendererRegistry } from "../../packages/web-client/src/renderer-registry";
import { validatePresentationDefinition } from "../../packages/web-client/src/presentation";

describe("presentation system", () => {
  test("validates battleship presentation definition", () => {
    const validated = validatePresentationDefinition(presentation);
    expect(validated.gameId).toBe("battleship");
    expect(validated.board.boardType).toBe("grid");
  });

  test("rejects references to unknown asset IDs", () => {
    expect(() =>
      validatePresentationDefinition({
        ...presentation,
        pieceSprites: {
          destroyer: "unknown-id"
        }
      })
    ).toThrow("unknown_asset_reference");
  });

  test("validates hex and boardless React-owned presentations", () => {
    const hex = validatePresentationDefinition(hexPresentation);
    expect(hex.board).toEqual({
      boardType: "hex",
      radius: 4,
      orientation: "pointy",
      hexSize: 48
    });

    const boardless = validatePresentationDefinition({
      ...presentation,
      gameId: "signal-crew",
      assets: [],
      pieceSprites: {},
      effects: {},
      board: { boardType: "none" }
    });
    expect(boardless.board).toEqual({ boardType: "none" });
  });

  test("rejects incomplete board metadata for each presentation type", () => {
    expect(() => validatePresentationDefinition({
      ...hexPresentation,
      board: { boardType: "hex", radius: 4 }
    })).toThrow("invalid_presentation_definition");
    expect(() => validatePresentationDefinition({
      ...presentation,
      board: { boardType: "grid", rows: 10, cols: 10 }
    })).toThrow("invalid_presentation_definition");
  });

  test("resolves asset paths from base path", () => {
    const validated = validatePresentationDefinition(presentation);
    const manager = new AssetManager(validated, "/games/battleship");
    expect(manager.resolveAssetUrl("tile-water")).toBe(
      "/games/battleship/assets/external/sea-warfare-set/effects/water.png"
    );
  });

  test("throws when resolving unknown asset", () => {
    const validated = validatePresentationDefinition(presentation);
    const manager = new AssetManager(validated, "/games/battleship");
    expect(() => manager.resolveAssetUrl("missing")).toThrow("asset_not_found");
  });

  test("registers and builds renderer by board type", () => {
    const registry = new RendererRegistry();
    registry.register("grid", () => ({ render: () => "ok" }));
    const renderer = registry.create("grid");
    expect(typeof renderer.render).toBe("function");
    expect(() => registry.create("hex")).toThrow("renderer_not_registered");
  });
});
