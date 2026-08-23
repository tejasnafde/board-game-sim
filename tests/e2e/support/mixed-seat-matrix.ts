import { battleshipBot } from "@board-game-sim/battleship";
import { connect4Bot } from "@board-game-sim/connect4";
import { hexKingdomsBot } from "@board-game-sim/hex-kingdoms";
import { labyrinthBot } from "@board-game-sim/labyrinth";
import { signalCrewBot } from "@board-game-sim/signal-crew";
import type { GameBot, JsonValue } from "@board-game-sim/shared";
import battleshipDefinition from "../../../packages/games/battleship/definition.json";
import connect4Definition from "../../../packages/games/connect4/definition.json";
import hexKingdomsDefinition from "../../../packages/games/hex-kingdoms/definition.json";
import labyrinthDefinition from "../../../packages/games/labyrinth/definition.json";
import signalCrewDefinition from "../../../packages/games/signal-crew/definition.json";
import { HEX_TEST_POLICIES } from "./hex-policies";
import { SIGNAL_TEST_POLICIES } from "./signal-policies";

type GameMatrixConfig = {
  gameId: string;
  definition: JsonValue;
  bot: GameBot;
  seatCounts: number[];
  maxActions: number;
  humanPolicies: (humanSeats: number, botSeats: number) => GameBot[];
};

export type MixedSeatScenario = GameMatrixConfig & {
  humanSeats: number;
  botSeats: number;
  mode: "all-ai" | "product";
  title: string;
};

function repeatedPolicy(bot: GameBot) {
  return (humanSeats: number) => Array.from({ length: humanSeats }, () => bot);
}

function rotatedPolicies(policies: readonly GameBot[]) {
  return (humanSeats: number, botSeats: number) => Array.from(
    { length: humanSeats },
    (_, index) => policies[(botSeats + index) % policies.length]!
  );
}

const GAMES: GameMatrixConfig[] = [
  {
    gameId: "battleship",
    definition: battleshipDefinition as JsonValue,
    bot: battleshipBot,
    seatCounts: [2],
    maxActions: 250,
    humanPolicies: repeatedPolicy(battleshipBot)
  },
  {
    gameId: "connect4",
    definition: connect4Definition as JsonValue,
    bot: connect4Bot,
    seatCounts: [2],
    maxActions: 50,
    humanPolicies: repeatedPolicy(connect4Bot)
  },
  {
    gameId: "labyrinth",
    definition: labyrinthDefinition as JsonValue,
    bot: labyrinthBot,
    seatCounts: [2, 3, 4],
    maxActions: 4_000,
    humanPolicies: repeatedPolicy(labyrinthBot)
  },
  {
    gameId: "hex-kingdoms",
    definition: hexKingdomsDefinition as JsonValue,
    bot: hexKingdomsBot,
    seatCounts: [2, 3, 4],
    maxActions: 50,
    humanPolicies: rotatedPolicies(HEX_TEST_POLICIES)
  },
  {
    gameId: "signal-crew",
    definition: signalCrewDefinition as JsonValue,
    bot: signalCrewBot,
    seatCounts: [2, 3, 4],
    maxActions: 100,
    humanPolicies: rotatedPolicies(SIGNAL_TEST_POLICIES)
  }
];

export const MIXED_SEAT_MATRIX: MixedSeatScenario[] = GAMES.flatMap((game) => (
  game.seatCounts.flatMap((seats) => {
    const allAi: MixedSeatScenario = {
      ...game,
      humanSeats: 0,
      botSeats: seats,
      mode: "all-ai",
      title: `${game.gameId}: ${seats} AI`
    };
    const product = Array.from({ length: seats }, (_, index): MixedSeatScenario => {
      const humanSeats = index + 1;
      const botSeats = seats - humanSeats;
      return {
        ...game,
        humanSeats,
        botSeats,
        mode: "product",
        title: `${game.gameId}: ${humanSeats} human + ${botSeats} AI`
      };
    });
    return [allAi, ...product];
  })
));
