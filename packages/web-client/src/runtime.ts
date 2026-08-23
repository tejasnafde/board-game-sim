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
  renderer: GameRenderer | null;
  controller: ReturnType<typeof createClientController>;
  assets?: AssetResolver;
  rejoin: () => void;
};

export type RenderedWebClientRuntime = WebClientRuntime & { renderer: GameRenderer };

type RuntimeInput = {
  presentation: unknown;
  baseAssetPath: string;
  transport: ControllerTransport;
  assets?: AssetResolver;
};

function createRuntimeBase(input: RuntimeInput): Omit<WebClientRuntime, "renderer"> {
  const presentation = validatePresentationDefinition(input.presentation);
  const assetManager = new AssetManager(presentation, input.baseAssetPath);
  const controller = createClientController(input.transport);
  return {
    presentation,
    assetManager,
    controller,
    assets: input.assets,
    rejoin: () => controller.rejoin()
  };
}

export function createWebClientRuntime(input: {
  presentation: unknown;
  baseAssetPath: string;
  transport: ControllerTransport;
  assets?: AssetResolver;
  createRenderer?: (context: {
    presentation: PresentationDefinition;
    assetManager: AssetManager;
  }) => GameRenderer;
}): RenderedWebClientRuntime {
  const runtime = createRuntimeBase(input);

  const rendererRegistry = new RendererRegistry();
  rendererRegistry.register("grid", () => new GridRenderer());
  const renderer = input.createRenderer?.({
    presentation: runtime.presentation,
    assetManager: runtime.assetManager
  }) ?? rendererRegistry.create(runtime.presentation.board.boardType);

  return { ...runtime, renderer };
}

export function createReactWebClientRuntime(input: RuntimeInput): WebClientRuntime {
  return { ...createRuntimeBase(input), renderer: null };
}
