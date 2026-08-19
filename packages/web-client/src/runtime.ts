import type { PresentationDefinition } from "./presentation";
import { validatePresentationDefinition } from "./presentation";
import { AssetManager } from "./asset-manager";
import { RendererRegistry, type GameRenderer } from "./renderer-registry";
import { GridRenderer } from "./grid-renderer";
import { createClientController, type ControllerTransport } from "./client-controller";
import type { AssetResolver } from "./asset-pack";

export type WebClientRuntime = {
  presentation: PresentationDefinition;
  assetManager: AssetManager;
  renderer: GameRenderer;
  controller: ReturnType<typeof createClientController>;
  assets?: AssetResolver;
  rejoin: () => void;
};

export function createWebClientRuntime(input: {
  presentation: unknown;
  baseAssetPath: string;
  transport: ControllerTransport;
  assets?: AssetResolver;
  createRenderer?: (context: {
    presentation: PresentationDefinition;
    assetManager: AssetManager;
  }) => GameRenderer;
}): WebClientRuntime {
  const presentation = validatePresentationDefinition(input.presentation);
  const assetManager = new AssetManager(presentation, input.baseAssetPath);

  const rendererRegistry = new RendererRegistry();
  rendererRegistry.register("grid", () => new GridRenderer());
  const renderer = input.createRenderer?.({ presentation, assetManager })
    ?? rendererRegistry.create(presentation.board.boardType);

  const controller = createClientController(input.transport);

  return {
    presentation,
    assetManager,
    renderer,
    controller,
    assets: input.assets,
    rejoin: () => {
      controller.rejoin();
    }
  };
}
