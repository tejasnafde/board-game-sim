import { InMemoryGameRegistry, type RegisteredGame } from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { LabyrinthModule } from "@board-game-sim/labyrinth";
import battleshipDefinition from "../../games/battleship/definition.json";
import labyrinthDefinition from "../../games/labyrinth/definition.json";

export type DemoSessionSeed = {
  sessionId: string;
  gameId: string;
  gameVersion: string;
  seed: string;
  players: string[];
};

export function registerBuiltInGames(registry: InMemoryGameRegistry): RegisteredGame[] {
  const games: RegisteredGame[] = [
    {
      gameId: "battleship",
      version: "0.1.0",
      definition: battleshipDefinition,
      module: new BattleshipModule()
    },
    {
      gameId: "labyrinth",
      version: "0.1.0",
      definition: labyrinthDefinition,
      module: new LabyrinthModule()
    }
  ];

  for (const game of games) {
    registry.register(game);
  }

  return games;
}
