import type { GameId } from "../routes";
import type { GameManifest } from "./types";
import { battleshipManifest } from "./battleship-manifest";
import { labyrinthManifest } from "./labyrinth-manifest";
import { connect4Manifest } from "./connect4-manifest";

const manifestsByGame: Partial<Record<GameId, GameManifest>> = {
  battleship: battleshipManifest,
  labyrinth: labyrinthManifest,
  connect4: connect4Manifest
};

export function getManifest(gameId: GameId): GameManifest | undefined {
  return manifestsByGame[gameId];
}

export { battleshipManifest, labyrinthManifest, connect4Manifest };
export type { GameManifest } from "./types";
