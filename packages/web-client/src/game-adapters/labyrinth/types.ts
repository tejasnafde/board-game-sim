import type { Coord } from "@board-game-sim/battleship";

export type LabyrinthView = {
  phase?: "play" | "terminal";
  turnStage?: "insert" | "move";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  config?: { rows?: number; cols?: number; insertionIndexes?: number[] };
  board?: Array<Array<{ openings: Record<"N" | "E" | "S" | "W", boolean>; objectiveId: string | null }>>;
  spareTile?: { openings?: Record<"N" | "E" | "S" | "W", boolean>; objectiveId?: string | null };
  lastInsertion?: { edge: string; index: number } | null;
  players?: Array<{ playerId: string; position: Coord; home?: Coord; objectivesRemainingCount: number; collectedObjectiveIds?: string[] }>;
  myState?: {
    position?: Coord;
    home?: Coord;
    remainingObjectives?: Array<{ id: string }>;
    reachableCells?: Coord[];
  };
};
