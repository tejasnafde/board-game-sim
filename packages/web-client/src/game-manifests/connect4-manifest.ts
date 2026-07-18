import type { GameManifest } from "./types";
import connect4Definition from "../../../games/connect4/definition.json";
import connect4Presentation from "../../../games/connect4/presentation.json";

export const connect4Manifest: GameManifest = {
  gameId: "connect4",
  definition: connect4Definition,
  presentation: connect4Presentation,
  defaultSessionId: "demo-connect4"
};
