import type { Coord } from "@board-game-sim/battleship";

export type LabyrinthView = {
  phase?: "play" | "terminal";
  turnStage?: "insert" | "move";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  config?: { insertionIndexes?: number[] };
  board?: Array<Array<{ openings: Record<"N" | "E" | "S" | "W", boolean>; objectiveId: string | null }>>;
  players?: Array<{ playerId: string; position: Coord; objectivesRemainingCount: number }>;
  myState?: {
    remainingObjectives?: Array<{ id: string }>;
    reachableCells?: Coord[];
  };
};
