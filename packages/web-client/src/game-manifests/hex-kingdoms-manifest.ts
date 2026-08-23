import type { GameManifest } from "./types";
import definition from "../../../games/hex-kingdoms/definition.json";
import presentation from "../../../games/hex-kingdoms/presentation.json";

export const hexKingdomsManifest: GameManifest = {
  gameId: "hex-kingdoms",
  definition,
  presentation,
  defaultSessionId: "demo-hex-kingdoms"
};
