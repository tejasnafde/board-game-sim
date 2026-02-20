export type BoardType = "grid" | "hex" | "graph";

export type PresentationAsset = {
  id: string;
  kind: "image" | "audio" | "sprite" | "font";
  path: string;
};

export type PresentationDefinition = {
  gameId: string;
  version: string;
  presentationVersion: string;
  board: {
    boardType: BoardType;
    rows: number;
    cols: number;
    cellSize: number;
  };
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

  return candidate;
}
