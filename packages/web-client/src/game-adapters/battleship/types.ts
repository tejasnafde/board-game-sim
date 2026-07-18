import type { Coord } from "@board-game-sim/battleship";

export type ClientView = {
  phase?: "setup" | "play" | "terminal";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  ownBoard?: { ships?: unknown[] };
};

export type Orientation = "horizontal" | "vertical";

export type PlacementDraft = {
  row: number;
  col: number;
  rotationDeg: 0 | 90 | 180 | 270;
};

export type ShipSpec = {
  id: string;
  size: number;
};

export type BattleshipDefinition = {
  board: { rows: number; cols: number };
  ships: ShipSpec[];
};
