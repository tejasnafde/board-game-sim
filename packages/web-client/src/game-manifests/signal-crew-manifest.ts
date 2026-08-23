import type { GameManifest } from "./types";
import definition from "../../../games/signal-crew/definition.json";
import presentation from "../../../games/signal-crew/presentation.json";

export const signalCrewManifest: GameManifest = {
  gameId: "signal-crew",
  definition,
  presentation,
  defaultSessionId: "demo-signal-crew"
};
