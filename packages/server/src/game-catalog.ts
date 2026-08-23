import type { RegisteredGame } from "@board-game-sim/engine";
import type { GameBot, JsonValue } from "@board-game-sim/shared";
import { BattleshipModule, battleshipBot } from "@board-game-sim/battleship";
import { LabyrinthModule, labyrinthBot } from "@board-game-sim/labyrinth";
import { Connect4Module, connect4Bot } from "@board-game-sim/connect4";
import { HexKingdomsModule, hexKingdomsBot } from "@board-game-sim/hex-kingdoms";
import { SignalCrewModule, signalCrewBot } from "@board-game-sim/signal-crew";
import battleshipDefinition from "../../games/battleship/definition.json";
import labyrinthDefinition from "../../games/labyrinth/definition.json";
import connect4Definition from "../../games/connect4/definition.json";
import hexKingdomsDefinition from "../../games/hex-kingdoms/definition.json";
import signalCrewDefinition from "../../games/signal-crew/definition.json";

export type BuiltInGame = RegisteredGame & {
  minSeats: number;
  maxSeats: number;
  bot: GameBot;
  definition: JsonValue;
};

export type BuiltInGameCatalog = {
  entries: readonly BuiltInGame[];
  resolve(gameId: string): BuiltInGame | null;
};

export function createBuiltInGameCatalog(entries: readonly BuiltInGame[]): BuiltInGameCatalog {
  const byId = new Map<string, BuiltInGame>();
  for (const entry of entries) {
    if (byId.has(entry.gameId)) {
      throw new Error(`duplicate_built_in_game:${entry.gameId}`);
    }
    byId.set(entry.gameId, Object.freeze({ ...entry }));
  }

  const frozenEntries = Object.freeze([...byId.values()]);

  return {
    entries: frozenEntries,
    resolve: (gameId) => byId.get(gameId) ?? null
  };
}

const catalog = createBuiltInGameCatalog([
  {
    gameId: "battleship",
    version: "0.1.0",
    definition: battleshipDefinition as JsonValue,
    module: new BattleshipModule(),
    minSeats: 2,
    maxSeats: 2,
    bot: battleshipBot
  },
  {
    gameId: "labyrinth",
    version: "0.1.0",
    definition: labyrinthDefinition as JsonValue,
    module: new LabyrinthModule(),
    minSeats: 2,
    maxSeats: 4,
    bot: labyrinthBot
  },
  {
    gameId: "connect4",
    version: "0.1.0",
    definition: connect4Definition as JsonValue,
    module: new Connect4Module(),
    minSeats: 2,
    maxSeats: 2,
    bot: connect4Bot
  },
  {
    gameId: "hex-kingdoms",
    version: "0.1.0",
    definition: hexKingdomsDefinition as JsonValue,
    module: new HexKingdomsModule(),
    minSeats: 2,
    maxSeats: 4,
    bot: hexKingdomsBot
  },
  {
    gameId: "signal-crew",
    version: "0.1.0",
    definition: signalCrewDefinition as JsonValue,
    module: new SignalCrewModule(),
    minSeats: 2,
    maxSeats: 4,
    bot: signalCrewBot
  }
]);

export const BUILT_IN_GAMES = catalog.entries;

export function resolveBuiltInGame(gameId: string): BuiltInGame | null {
  return catalog.resolve(gameId);
}
