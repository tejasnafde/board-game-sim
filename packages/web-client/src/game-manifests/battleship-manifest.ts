import type { GameManifest } from "./types";
import battleshipDefinition from "../../../games/battleship/definition.json";
import battleshipPresentation from "../../../games/battleship/presentation.json";

export const battleshipManifest: GameManifest = {
  gameId: "battleship",
  definition: battleshipDefinition,
  presentation: battleshipPresentation,
  defaultSessionId: "demo-battleship"
};
