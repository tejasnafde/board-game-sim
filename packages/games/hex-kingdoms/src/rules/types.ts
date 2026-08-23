import type { AxialCoord } from "@board-game-sim/shared";

export const HEX_TERRAINS = ["meadow", "forest", "mountain", "water"] as const;
export const HEX_FEATURES = ["plain", "village", "keep", "shrine"] as const;

export type HexTerrain = (typeof HEX_TERRAINS)[number];
export type HexFeature = (typeof HEX_FEATURES)[number];

export type HexTile = {
  id: string;
  terrain: HexTerrain;
  feature: HexFeature;
};

export type HexLayout = {
  radius: number;
  capitals: AxialCoord[];
  landmarks: AxialCoord[];
};

export type HexScoringConfig = {
  crownlandsPerTile: number;
  diversitySet: number;
  villageCap: number;
  keepCap: number;
  shrineByLandmark: number;
  landmarkUnique: number;
  landmarkTied: number;
};

export type HexKingdomsConfig = {
  gameId: "hex-kingdoms";
  version: string;
  minPlayers: 2;
  maxPlayers: 4;
  turnsPerPlayer: number;
  marketSize: number;
  terrains: HexTerrain[];
  tileRecipe: Record<HexFeature, number>;
  layouts: Record<2 | 3 | 4, HexLayout>;
  scoring: HexScoringConfig;
};

export type HexPlacement = {
  tileId: string;
  ownerPlayerId: string;
  coordinate: AxialCoord;
  terrain: HexTerrain;
  feature: HexFeature;
};

export type HexScore = {
  crownlands: number;
  provinces: Record<HexTerrain, number>;
  diversity: number;
  features: {
    villages: number;
    keeps: number;
    shrines: number;
  };
  landmarks: number;
  largestProvince: number;
  total: number;
};

export type HexKingdomsState = {
  phase: "play" | "terminal";
  config: HexKingdomsConfig;
  players: string[];
  capitals: Record<string, AxialCoord>;
  landmarks: AxialCoord[];
  market: HexTile[];
  drawPile: HexTile[];
  placements: HexPlacement[];
  startPlayerIndex: number;
  currentPlayerId: string;
  turnIndex: number;
  scores: Record<string, HexScore>;
  winnerPlayerIds: string[];
  winnerPlayerId: string | null;
};

export type HexKingdomsView = {
  phase: "play" | "terminal";
  config: HexKingdomsConfig;
  players: string[];
  capitals: Record<string, AxialCoord>;
  landmarks: AxialCoord[];
  market: HexTile[];
  placements: HexPlacement[];
  currentPlayerId: string;
  turnIndex: number;
  round: number;
  turnsTotal: number;
  remainingTileCount: number;
  scores: Record<string, HexScore>;
  winnerPlayerIds: string[];
  winnerPlayerId: string | null;
  youPlayerId: string;
  canAct: boolean;
  legalCoordinates: AxialCoord[];
};
