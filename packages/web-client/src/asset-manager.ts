import type { PresentationDefinition } from "./presentation";

function joinPath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const normalizedRelative = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}/${normalizedRelative}`;
}

export class AssetManager {
  private readonly assetPathById: Map<string, string>;

  constructor(
    private readonly presentation: PresentationDefinition,
    private readonly basePath: string
  ) {
    this.assetPathById = new Map(
      presentation.assets.map((asset) => [asset.id, joinPath(basePath, asset.path)])
    );
  }

  resolveAssetUrl(assetId: string): string {
    const url = this.assetPathById.get(assetId);
    if (!url) {
      throw new Error(`asset_not_found:${assetId}`);
    }
    return url;
  }

  listAssetIds(): string[] {
    return [...this.assetPathById.keys()];
  }

  getPresentation(): PresentationDefinition {
    return this.presentation;
  }
}
