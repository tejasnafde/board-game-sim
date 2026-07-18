export type Coord = { row: number; col: number };

export type ShipPlacement = {
  shipId: string;
  cells: Coord[];
};

export type BattleshipShipSpec = {
  id: string;
  size: number;
};

export type BattleshipConfig = {
  rows: number;
  cols: number;
  ships: BattleshipShipSpec[];
};

export type BattleshipPlayerState = {
  playerId: string;
  ships: ShipPlacement[];
  shotsFired: Coord[];
  hitsTaken: Coord[];
  sunkShipIds: string[];
  setupComplete: boolean;
};

export type BattleshipState = {
  phase: "setup" | "play" | "terminal";
  config: BattleshipConfig;
  players: BattleshipPlayerState[];
  currentPlayerId: string;
  winnerPlayerId: string | null;
};
