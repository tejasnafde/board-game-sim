import type { ControllerTransport } from "../client-controller";
import { battleshipManifest, connect4Manifest, labyrinthManifest } from "../game-manifests";
import { createWebClientRuntime } from "../runtime";
import { createBattleshipUiAdapter } from "./battleship";
import { createConnect4UiAdapter } from "./connect4";
import { createLabyrinthUiAdapter } from "./labyrinth";

export function createPlayableGameUiAdapters(input: {
  transport: ControllerTransport;
  baseAssetPath: string;
}) {
  const runtimeFor = (presentation: unknown) => createWebClientRuntime({
    presentation,
    baseAssetPath: input.baseAssetPath,
    transport: input.transport
  });

  return {
    battleship: createBattleshipUiAdapter(runtimeFor(battleshipManifest.presentation)),
    labyrinth: createLabyrinthUiAdapter(runtimeFor(labyrinthManifest.presentation)),
    connect4: createConnect4UiAdapter(runtimeFor(connect4Manifest.presentation))
  };
}

export type {
  PlayableGameBindContext,
  PlayableGameRenderContext,
  PlayableGameUiAdapter
} from "./playable-game-ui";
