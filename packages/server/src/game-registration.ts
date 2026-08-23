import { InMemoryGameRegistry, type RegisteredGame } from "@board-game-sim/engine";
import { BUILT_IN_GAMES } from "./game-catalog";

export type DemoSessionSeed = {
  sessionId: string;
  gameId: string;
  gameVersion: string;
  seed: string;
  players: string[];
};

export function registerBuiltInGames(registry: InMemoryGameRegistry): RegisteredGame[] {
  const games: RegisteredGame[] = [...BUILT_IN_GAMES];

  for (const game of games) {
    registry.register(game);
  }

  return games;
}
