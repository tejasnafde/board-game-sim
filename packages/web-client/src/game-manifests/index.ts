import type { GameId } from "../routes";
import type { GameManifest } from "./types";
import { battleshipManifest } from "./battleship-manifest";
import { labyrinthManifest } from "./labyrinth-manifest";

const manifestsByGame: Partial<Record<GameId, GameManifest>> = {
  battleship: battleshipManifest,
  labyrinth: labyrinthManifest
};

export function getManifest(gameId: GameId): GameManifest | undefined {
  return manifestsByGame[gameId];
}

export { battleshipManifest, labyrinthManifest };
export type { GameManifest } from "./types";
