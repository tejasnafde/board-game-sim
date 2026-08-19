import type { ControllerTransport } from "../client-controller";
import { gameCatalog } from "../registered-games";

export function createPlayableGameUiAdapters(input: {
  transport: ControllerTransport;
  baseAssetPath: string;
  assetPackByGame?: Record<string, string | undefined>;
}) {
  return new Map(gameCatalog.listPlayable().map((entry) => {
    if (!entry.client) {
      throw new Error(`playable_game_client_missing:${entry.manifest.gameId}`);
    }
    return [
      entry.manifest.gameId,
      entry.client.createUiAdapter({
        transport: input.transport,
        baseAssetPath: input.baseAssetPath,
        assetPackId: input.assetPackByGame?.[entry.manifest.gameId]
      })
    ];
  }));
}

export type {
  PlayableGameBindContext,
  PlayableGameRenderContext,
  PlayableGameUiAdapter
} from "./playable-game-ui";
