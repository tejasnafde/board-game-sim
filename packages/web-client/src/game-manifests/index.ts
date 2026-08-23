import type { GameId } from "../routes";
import type { GameManifest } from "./types";
import { battleshipManifest } from "./battleship-manifest";
import { labyrinthManifest } from "./labyrinth-manifest";
import { connect4Manifest } from "./connect4-manifest";
import { hexKingdomsManifest } from "./hex-kingdoms-manifest";

const manifestsByGame: Partial<Record<GameId, GameManifest>> = {
  battleship: battleshipManifest,
  labyrinth: labyrinthManifest,
  connect4: connect4Manifest,
  "hex-kingdoms": hexKingdomsManifest
};

export function getManifest(gameId: GameId): GameManifest | undefined {
  return manifestsByGame[gameId];
}

export { battleshipManifest, labyrinthManifest, connect4Manifest, hexKingdomsManifest };
export type { GameManifest } from "./types";
