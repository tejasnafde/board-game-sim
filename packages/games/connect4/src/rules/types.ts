export type Coord = { row: number; col: number };

export type Connect4Config = {
  rows: number;
  cols: number;
  connect: number;
};

export type Connect4State = {
  phase: "play" | "terminal";
  config: Connect4Config;
  /** grid[row][col]; row 0 is the TOP. null = empty, else a playerId. */
  grid: (string | null)[][];
  players: string[];
  currentPlayerId: string;
  winnerPlayerId: string | null;
  winningCells: Coord[];
  lastDrop: Coord | null;
};

export type DropPayload = { col: number };
