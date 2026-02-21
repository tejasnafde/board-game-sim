import type { GameId } from "../routes";

export type GameManifest = {
  gameId: GameId;
  definition: unknown;
  presentation: unknown;
  defaultSessionId: string;
};
