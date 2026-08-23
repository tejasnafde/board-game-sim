export type BoardType = "grid" | "hex" | "graph" | "none";

export type PresentationBoard =
  | { boardType: "grid"; rows: number; cols: number; cellSize: number }
  | { boardType: "hex"; radius: number; orientation: "pointy" | "flat"; hexSize: number }
  | { boardType: "graph" }
  | { boardType: "none" };

export type PresentationAsset = {
  id: string;
  kind: "image" | "audio" | "sprite" | "font";
  path: string;
};

export type PresentationDefinition = {
  gameId: string;
  version: string;
  presentationVersion: string;
  board: PresentationBoard;
  theme: {
    name: string;
    colors: Record<string, string>;
  };
  assets: PresentationAsset[];
  pieceSprites: Record<string, string>;
  effects: Record<string, string>;
};

export function validatePresentationDefinition(input: unknown): PresentationDefinition {
  const candidate = input as PresentationDefinition;

  if (!candidate?.gameId || !candidate?.presentationVersion) {
    throw new Error("invalid_presentation_definition");
  }

  if (!candidate.board || !candidate.board.boardType) {
    throw new Error("invalid_presentation_definition");
  }

  const board = candidate.board;
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
  if (board.boardType === "grid"
    && (!Number.isInteger(board.rows) || board.rows <= 0
      || !Number.isInteger(board.cols) || board.cols <= 0
      || !positive(board.cellSize))) {
    throw new Error("invalid_presentation_definition");
  }
  if (board.boardType === "hex"
    && (!Number.isInteger(board.radius) || board.radius < 0
      || (board.orientation !== "pointy" && board.orientation !== "flat")
      || !positive(board.hexSize))) {
    throw new Error("invalid_presentation_definition");
  }
  if (!["grid", "hex", "graph", "none"].includes(board.boardType)) {
    throw new Error("invalid_presentation_definition");
  }

  const assets = candidate.assets ?? [];
  const assetIds = new Set(assets.map((asset) => asset.id));

  for (const assetId of Object.values(candidate.pieceSprites ?? {})) {
    if (!assetIds.has(assetId)) {
      throw new Error(`unknown_asset_reference:${assetId}`);
    }
  }

  for (const assetId of Object.values(candidate.effects ?? {})) {
    if (!assetIds.has(assetId)) {
      throw new Error(`unknown_asset_reference:${assetId}`);
    }
  }

  return {
    ...candidate,
    assets,
    pieceSprites: candidate.pieceSprites ?? {},
    effects: candidate.effects ?? {}
  };
}
