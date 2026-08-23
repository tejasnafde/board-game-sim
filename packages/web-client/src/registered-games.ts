import type { ControllerTransport } from "./client-controller";
import type { AssetPackRegistry } from "./asset-pack";
import { createGameCatalog, type GameCatalogEntry } from "./game-catalog";
import { battleshipManifest, connect4Manifest, hexKingdomsManifest, labyrinthManifest } from "./game-manifests";
import { createBattleshipUiAdapter } from "./game-adapters/battleship";
import { createConnect4UiAdapter } from "./game-adapters/connect4";
import { createLabyrinthUiAdapter } from "./game-adapters/labyrinth";
import { createHexKingdomsUiAdapter } from "./game-adapters/hex-kingdoms";
import type { PlayableGameUiAdapter } from "./game-adapters/playable-game-ui";
import { createReactWebClientRuntime, createWebClientRuntime } from "./runtime";
import { battleshipAssetPacks } from "./game-assets/battleship";
import { GridRenderer } from "./grid-renderer";

export type GameClientModule = {
  createUiAdapter(input: {
    transport: ControllerTransport;
    baseAssetPath: string;
    assetPackId?: string;
  }): PlayableGameUiAdapter;
  assetPacks?: AssetPackRegistry;
};

export type RegisteredGame = GameCatalogEntry<GameClientModule>;

export const gameCatalog = createGameCatalog<RegisteredGame>([
  {
    manifest: {
      gameId: "battleship",
      version: "0.1.0",
      title: "Battleship",
      summary: "Hidden fleet placement with tactical turn-based strikes.",
      status: "live",
      releaseTag: "Playable now",
      players: "2 players",
      turnStyle: "Alternating turns",
      defaultAssetPackId: "sea-command"
    },
    client: {
      createUiAdapter: ({ transport, baseAssetPath, assetPackId }) => {
        const assets = battleshipAssetPacks.select(assetPackId);
        return createBattleshipUiAdapter(createWebClientRuntime({
          presentation: battleshipManifest.presentation,
          baseAssetPath,
          transport,
          assets,
          createRenderer: () => new GridRenderer({
            shipById: Object.fromEntries([
              "carrier",
              "battleship",
              "cruiser",
              "submarine",
              "destroyer"
            ].map((shipId) => {
              const asset = assets.resolve(`piece.${shipId}`);
              return [shipId, { url: asset.url, nativeFacing: asset.nativeFacing }];
            })),
            hitUrl: assets.resolve("effect.shot.hit").url,
            missUrl: assets.resolve("effect.shot.miss").url
          })
        }));
      },
      assetPacks: battleshipAssetPacks
    }
  },
  {
    manifest: {
      gameId: "labyrinth",
      version: "0.1.0",
      title: "Labyrinth",
      summary: "Shifting maze strategy with rotating board pathways.",
      status: "live",
      releaseTag: "Playable now",
      players: "2-4 players",
      turnStyle: "Board transform turns",
      defaultAssetPackId: "maze-vault"
    },
    client: {
      createUiAdapter: ({ transport, baseAssetPath }) => createLabyrinthUiAdapter(
        createWebClientRuntime({
          presentation: labyrinthManifest.presentation,
          baseAssetPath,
          transport
        })
      )
    }
  },
  {
    manifest: {
      gameId: "connect4",
      version: "0.1.0",
      title: "Connect Four",
      summary: "Drop discs and connect four — beat a friend or the computer.",
      status: "live",
      releaseTag: "Playable now",
      players: "2 players (or vs AI)",
      turnStyle: "Alternating drops",
      defaultAssetPackId: "arcade-drop"
    },
    client: {
      createUiAdapter: ({ transport, baseAssetPath }) => createConnect4UiAdapter(
        createWebClientRuntime({
          presentation: connect4Manifest.presentation,
          baseAssetPath,
          transport
        })
      )
    }
  },
  {
    manifest: {
      gameId: "hex-kingdoms",
      version: "0.1.0",
      title: "Hex Kingdoms",
      summary: "Draft terrain, connect your realm, and contest ancient landmarks.",
      status: "live",
      releaseTag: "Playable now",
      players: "2-4 players",
      turnStyle: "Ten placement turns",
      defaultAssetPackId: "crownlands-table"
    },
    client: {
      createUiAdapter: ({ transport, baseAssetPath }) => createHexKingdomsUiAdapter(
        createReactWebClientRuntime({
          presentation: hexKingdomsManifest.presentation,
          baseAssetPath,
          transport
        })
      )
    }
  },
  {
    manifest: {
      gameId: "catan",
      version: "0.0.0",
      title: "Catan",
      summary: "Resource trading and settlement growth on a hex island.",
      status: "coming-soon",
      releaseTag: "Coming soon: later milestone",
      players: "3-4 players",
      turnStyle: "Dice + trading rounds",
      defaultAssetPackId: "roadmap"
    }
  }
]);
