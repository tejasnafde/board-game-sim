import type { AppRoute, GameId } from "./routes";

export type HubCard = {
  gameId: GameId;
  name: string;
  subtitle: string;
  status: "live" | "coming-soon";
  releaseTag: string;
  players: string;
  turnStyle: string;
};

export const GAME_HUB_CARDS: HubCard[] = [
  {
    gameId: "battleship",
    name: "Battleship",
    subtitle: "Hidden fleet placement with tactical turn-based strikes.",
    status: "live",
    releaseTag: "Playable now",
    players: "2 players",
    turnStyle: "Alternating turns"
  },
  {
    gameId: "labyrinth",
    name: "Labyrinth",
    subtitle: "Shifting maze strategy with rotating board pathways.",
    status: "live",
    releaseTag: "Playable now",
    players: "2-4 players",
    turnStyle: "Board transform turns"
  },
  {
    gameId: "connect4",
    name: "Connect Four",
    subtitle: "Drop discs and connect four — beat a friend or the computer.",
    status: "live",
    releaseTag: "Playable now",
    players: "2 players (or vs AI)",
    turnStyle: "Alternating drops"
  },
  {
    gameId: "catan",
    name: "Catan",
    subtitle: "Resource trading and settlement growth on a hex island.",
    status: "coming-soon",
    releaseTag: "Coming soon: later milestone",
    players: "3-4 players",
    turnStyle: "Dice + trading rounds"
  }
];

export function resolveGameHubNavigation(gameId: GameId): AppRoute | null {
  if (gameId === "catan") return null;
  return { name: "game", gameId };
}
