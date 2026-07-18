export type Connect4View = {
  phase?: "play" | "terminal";
  config?: { rows: number; cols: number; connect: number };
  grid?: (string | null)[][];
  players?: string[];
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  winningCells?: { row: number; col: number }[];
  lastDrop?: { row: number; col: number } | null;
};
