import type { PresentationDefinition } from "./presentation";
import { validatePresentationDefinition } from "./presentation";
import { AssetManager } from "./asset-manager";
import { RendererRegistry, type GameRenderer } from "./renderer-registry";
import { GridRenderer } from "./grid-renderer";
import { createClientController, type ControllerTransport } from "./client-controller";

export type WebClientRuntime = {
  presentation: PresentationDefinition;
  assetManager: AssetManager;
  renderer: GameRenderer;
  controller: ReturnType<typeof createClientController>;
  rejoin: () => void;
};

export function createWebClientRuntime(input: {
  presentation: unknown;
  baseAssetPath: string;
  transport: ControllerTransport;
}): WebClientRuntime {
  const presentation = validatePresentationDefinition(input.presentation);
  const assetManager = new AssetManager(presentation, input.baseAssetPath);

  const rendererRegistry = new RendererRegistry();
  rendererRegistry.register("grid", () => new GridRenderer({
    shipUrlById: Object.fromEntries(
      Object.entries(presentation.pieceSprites).map(([pieceId, assetId]) => [
        pieceId,
        assetManager.resolveAssetUrl(assetId)
      ])
    ),
    hitUrl: presentation.effects["shot.hit"]
      ? assetManager.resolveAssetUrl(presentation.effects["shot.hit"])
      : undefined,
    missUrl: presentation.effects["shot.miss"]
      ? assetManager.resolveAssetUrl(presentation.effects["shot.miss"])
      : undefined
  }));
  const renderer = rendererRegistry.create(presentation.board.boardType);

  const controller = createClientController(input.transport);

  return {
    presentation,
    assetManager,
    renderer,
    controller,
    rejoin: () => {
      controller.rejoin();
    }
  };
}
