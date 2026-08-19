import { createAssetPackRegistry, type AssetPack } from "../asset-pack";

const seaCommand: AssetPack = {
  gameId: "battleship",
  packId: "sea-command",
  version: "1.0.0",
  roles: {
    "piece.carrier": { path: "sea/ships/carrier.png", kind: "image", sourceId: "sea-warfare", nativeFacing: "north", fit: "contain" },
    "piece.battleship": { path: "sea/ships/battleship.png", kind: "image", sourceId: "sea-warfare", nativeFacing: "north", fit: "contain" },
    "piece.cruiser": { path: "sea/ships/cruiser.png", kind: "image", sourceId: "sea-warfare", nativeFacing: "north", fit: "contain" },
    "piece.submarine": { path: "sea/ships/submarine.png", kind: "image", sourceId: "sea-warfare", nativeFacing: "north", fit: "contain" },
    "piece.destroyer": { path: "sea/ships/destroyer.png", kind: "image", sourceId: "sea-warfare", nativeFacing: "north", fit: "contain" },
    "effect.shot.hit": { path: "sea/effects/hit.png", kind: "image", sourceId: "sea-warfare", fit: "cover" },
    "effect.shot.miss": { path: "sea/effects/miss.png", kind: "image", sourceId: "sea-warfare", fit: "cover" },
    "surface.water": { path: "sea/effects/water.png", kind: "image", sourceId: "sea-warfare", fit: "cover", repeat: true }
  },
  theme: {
    "--game-board": "#08243d",
    "--game-grid": "#1d5b82",
    "--game-accent": "#f5b63b"
  },
  sources: [{
    id: "sea-warfare",
    license: "CC0-1.0",
    author: "Lowder2",
    sourceUrl: "https://opengameart.org/content/sea-warfare-set-ships-and-more",
    noticePath: "packages/games/battleship/assets/external/sea-warfare-set/ATTRIBUTION.md"
  }]
};

const classicVector: AssetPack = {
  gameId: "battleship",
  packId: "classic-vector",
  version: "1.0.0",
  roles: {
    "piece.carrier": { path: "classic/ships/carrier.svg", kind: "image", sourceId: "board-game-sim", nativeFacing: "east", fit: "contain" },
    "piece.battleship": { path: "classic/ships/battleship.svg", kind: "image", sourceId: "board-game-sim", nativeFacing: "east", fit: "contain" },
    "piece.cruiser": { path: "classic/ships/cruiser.svg", kind: "image", sourceId: "board-game-sim", nativeFacing: "east", fit: "contain" },
    "piece.submarine": { path: "classic/ships/submarine.svg", kind: "image", sourceId: "board-game-sim", nativeFacing: "east", fit: "contain" },
    "piece.destroyer": { path: "classic/ships/destroyer.svg", kind: "image", sourceId: "board-game-sim", nativeFacing: "east", fit: "contain" },
    "effect.shot.hit": { path: "classic/effects/hit.svg", kind: "image", sourceId: "board-game-sim", fit: "cover" },
    "effect.shot.miss": { path: "classic/effects/miss.svg", kind: "image", sourceId: "board-game-sim", fit: "cover" },
    "surface.water": { path: "classic/effects/water.svg", kind: "image", sourceId: "board-game-sim", fit: "cover", repeat: true }
  },
  theme: {
    "--game-board": "#062a4b",
    "--game-grid": "#0f4d78",
    "--game-accent": "#f6c453"
  },
  sources: [{
    id: "board-game-sim",
    license: "LicenseRef-BoardGameSim",
    author: "Board Game Sim contributors",
    sourceUrl: "https://github.com/tejasnafde/board-game-sim"
  }]
};

const assetUrlByPath = {
  "sea/ships/carrier.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/ships/carrier.png", import.meta.url).href,
  "sea/ships/battleship.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/ships/battleship.png", import.meta.url).href,
  "sea/ships/cruiser.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/ships/cruiser.png", import.meta.url).href,
  "sea/ships/submarine.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/ships/submarine.png", import.meta.url).href,
  "sea/ships/destroyer.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/ships/destroyer.png", import.meta.url).href,
  "sea/effects/hit.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/effects/hit.png", import.meta.url).href,
  "sea/effects/miss.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/effects/miss.png", import.meta.url).href,
  "sea/effects/water.png": new URL("../../../games/battleship/assets/external/sea-warfare-set/effects/water.png", import.meta.url).href,
  "classic/ships/carrier.svg": new URL("../../../games/battleship/assets/ships/carrier.svg", import.meta.url).href,
  "classic/ships/battleship.svg": new URL("../../../games/battleship/assets/ships/battleship.svg", import.meta.url).href,
  "classic/ships/cruiser.svg": new URL("../../../games/battleship/assets/ships/cruiser.svg", import.meta.url).href,
  "classic/ships/submarine.svg": new URL("../../../games/battleship/assets/ships/submarine.svg", import.meta.url).href,
  "classic/ships/destroyer.svg": new URL("../../../games/battleship/assets/ships/destroyer.svg", import.meta.url).href,
  "classic/effects/hit.svg": new URL("../../../games/battleship/assets/tiles/hit.svg", import.meta.url).href,
  "classic/effects/miss.svg": new URL("../../../games/battleship/assets/tiles/miss.svg", import.meta.url).href,
  "classic/effects/water.svg": new URL("../../../games/battleship/assets/tiles/water.svg", import.meta.url).href
};

export const battleshipAssetPacks = createAssetPackRegistry({
  gameId: "battleship",
  packs: [seaCommand, classicVector],
  defaultPackId: "sea-command",
  requiredRoles: [
    "piece.carrier",
    "piece.battleship",
    "piece.cruiser",
    "piece.submarine",
    "piece.destroyer",
    "effect.shot.hit",
    "effect.shot.miss",
    "surface.water"
  ],
  assetUrlByPath
});
