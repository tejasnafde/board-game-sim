export type Coord = { row: number; col: number };

export type ShipPlacement = {
  shipId: string;
  cells: Coord[];
};

export type BattleshipPlayerState = {
  playerId: string;
  ships: ShipPlacement[];
  shotsFired: Coord[];
  hitsTaken: Coord[];
  setupComplete: boolean;
};

export type BattleshipState = {
  phase: "setup" | "play" | "terminal";
  players: BattleshipPlayerState[];
  currentPlayerId: string;
  winnerPlayerId: string | null;
};
