import type { GameManifest } from "./types";
import labyrinthDefinition from "../../../games/labyrinth/definition.json";
import labyrinthPresentation from "../../../games/labyrinth/presentation.json";

export const labyrinthManifest: GameManifest = {
  gameId: "labyrinth",
  definition: labyrinthDefinition,
  presentation: labyrinthPresentation,
  defaultSessionId: "demo-labyrinth"
};
