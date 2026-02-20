import type { GameModule, JsonValue } from "@board-game-sim/shared";

export type RegisteredGame<State = JsonValue> = {
  gameId: string;
  version: string;
  definition: JsonValue;
  module: GameModule<State>;
};

export interface GameRegistry {
  register(game: RegisteredGame): void;
  resolve(gameId: string, version: string): RegisteredGame | null;
}

export class InMemoryGameRegistry implements GameRegistry {
  private readonly games = new Map<string, RegisteredGame>();

  register(game: RegisteredGame): void {
    this.games.set(`${game.gameId}@${game.version}`, game);
  }

  resolve(gameId: string, version: string): RegisteredGame | null {
    return this.games.get(`${gameId}@${version}`) ?? null;
  }
}

