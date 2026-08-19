export type Coord = { row: number; col: number };

export type Edge = "top" | "bottom" | "left" | "right";

export type Direction = "N" | "E" | "S" | "W";

export type TileShape = "straight" | "corner" | "tee";

export type Tile = {
  id: string;
  shape: TileShape;
  rotationDeg: 0 | 90 | 180 | 270;
  openings: Record<Direction, boolean>;
  objectiveId: string | null;
};

export type PlayerObjective = {
  id: string;
};

export type LabyrinthPlayerState = {
  playerId: string;
  home: Coord;
  position: Coord;
  remainingObjectives: PlayerObjective[];
  collectedObjectiveIds: string[];
};

export type Insertion = {
  edge: Edge;
  index: number;
};

export type LabyrinthConfig = {
  rows: number;
  cols: number;
  insertionIndexes: number[];
  objectivesPerPlayer: number;
};

export type LabyrinthState = {
  phase: "play" | "terminal";
  /** players who have finished, in placement order; play continues until
      only one player remains unfinished */
  finishOrder: string[];
  turnStage: "insert" | "move";
  config: LabyrinthConfig;
  board: Tile[][];
  spareTile: Tile;
  players: LabyrinthPlayerState[];
  currentPlayerId: string;
  winnerPlayerId: string | null;
  lastInsertion: Insertion | null;
};

export type InsertTilePayload = Insertion;

export type RotationDeg = 0 | 90 | 180 | 270;

export type RotateSparePayload = {
  rotationDeg: RotationDeg;
};

export type MovePawnPayload = Coord;
