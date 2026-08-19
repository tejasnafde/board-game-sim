import type { Coord } from "@board-game-sim/labyrinth";

export type LabyrinthView = {
  phase?: "play" | "terminal";
  turnStage?: "insert" | "move";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  config?: { rows?: number; cols?: number; insertionIndexes?: number[] };
  board?: Array<Array<{
    id: string;
    shape: "straight" | "corner" | "tee";
    rotationDeg: 0 | 90 | 180 | 270;
    openings: Record<"N" | "E" | "S" | "W", boolean>;
    objectiveId: string | null;
  }>>;
  spareTile?: {
    id?: string;
    shape?: "straight" | "corner" | "tee";
    rotationDeg?: 0 | 90 | 180 | 270;
    openings?: Record<"N" | "E" | "S" | "W", boolean>;
    objectiveId?: string | null;
  };
  lastInsertion?: { edge: string; index: number } | null;
  players?: Array<{ playerId: string; position: Coord; home?: Coord; objectivesRemainingCount: number; collectedObjectiveIds?: string[]; finishedRank?: number | null }>;
  myState?: {
    position?: Coord;
    home?: Coord;
    remainingObjectives?: Array<{ id: string; position?: Coord | null }>;
    reachableCells?: Coord[];
  };
};
