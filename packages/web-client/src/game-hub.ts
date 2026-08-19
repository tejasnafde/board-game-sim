import type { AppRoute, GameId } from "./routes";
import { gameCatalog } from "./registered-games";

export type HubCard = {
  gameId: GameId;
  name: string;
  subtitle: string;
  status: "live" | "coming-soon";
  releaseTag: string;
  players: string;
  turnStyle: string;
};

export const GAME_HUB_CARDS: HubCard[] = gameCatalog.list().map(({ manifest }) => ({
  gameId: manifest.gameId,
  name: manifest.title,
  subtitle: manifest.summary,
  status: manifest.status,
  releaseTag: manifest.releaseTag,
  players: manifest.players,
  turnStyle: manifest.turnStyle
}));

export function resolveGameHubNavigation(gameId: GameId): AppRoute | null {
  return gameCatalog.resolvePlayable(gameId) ? { name: "game", gameId } : null;
}
