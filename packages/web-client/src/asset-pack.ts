export type AssetSource = {
  id: string;
  license: string;
  author: string;
  sourceUrl: string;
  noticePath?: string;
};

export type AssetReference = {
  path: string;
  kind: "image" | "audio" | "font";
  sourceId: string;
  nativeFacing?: "north" | "east" | "south" | "west";
  fit?: "contain" | "cover" | "fill";
  anchor?: "center" | "top" | "right" | "bottom" | "left";
  repeat?: boolean;
  bleed?: number;
};

export type AssetPack = {
  gameId: string;
  packId: string;
  version: string;
  roles: Record<string, AssetReference>;
  theme: Record<string, string>;
  sources: AssetSource[];
};

export type ResolvedAsset = AssetReference & {
  url: string;
  source: AssetSource;
};

export type AssetCredit = Omit<AssetSource, "id" | "noticePath">;

export type AssetResolver = {
  packId: string;
  resolve(role: string): ResolvedAsset;
  themeVariables(): Record<string, string>;
  credits(): AssetCredit[];
};

export type AssetPackRegistry = {
  select(packId?: string): AssetResolver;
  list(): AssetPack[];
};

export function createAssetPackRegistry(input: {
  gameId: string;
  packs: AssetPack[];
  defaultPackId: string;
  requiredRoles: string[];
  assetUrlByPath: Record<string, string>;
}): AssetPackRegistry {
  const packById = new Map<string, AssetPack>();
  const resolverById = new Map<string, AssetResolver>();

  for (const pack of input.packs) {
    if (packById.has(pack.packId)) {
      throw new Error(`duplicate_asset_pack:${pack.packId}`);
    }
    if (pack.gameId !== input.gameId) {
      throw new Error(`asset_pack_game_mismatch:${pack.packId}:${pack.gameId}`);
    }

    const sourceById = new Map<string, AssetSource>();
    for (const source of pack.sources) {
      if (!source.id || !source.license || !source.author || !source.sourceUrl) {
        throw new Error(`invalid_asset_source:${pack.packId}:${source.id}`);
      }
      if (sourceById.has(source.id)) {
        throw new Error(`duplicate_asset_source:${pack.packId}:${source.id}`);
      }
      sourceById.set(source.id, source);
    }
    for (const role of input.requiredRoles) {
      if (!pack.roles[role]) {
        throw new Error(`missing_asset_role:${pack.packId}:${role}`);
      }
    }
    const assetByRole = new Map<string, ResolvedAsset>();
    for (const [role, reference] of Object.entries(pack.roles)) {
      const source = sourceById.get(reference.sourceId);
      if (!source) {
        throw new Error(`unknown_asset_source:${pack.packId}:${reference.sourceId}`);
      }
      const url = input.assetUrlByPath[reference.path];
      if (!url) {
        throw new Error(`asset_file_not_found:${pack.packId}:${reference.path}`);
      }
      assetByRole.set(role, { ...reference, url, source });
    }

    packById.set(pack.packId, pack);
    resolverById.set(pack.packId, {
      packId: pack.packId,
      resolve: (role) => {
        const asset = assetByRole.get(role);
        if (!asset) {
          throw new Error(`asset_role_not_found:${pack.packId}:${role}`);
        }
        return asset;
      },
      themeVariables: () => ({ ...pack.theme }),
      credits: () => pack.sources.map(({ license, author, sourceUrl }) => ({
        license,
        author,
        sourceUrl
      }))
    });
  }

  const defaultResolver = resolverById.get(input.defaultPackId);
  if (!defaultResolver) {
    throw new Error(`default_asset_pack_not_found:${input.defaultPackId}`);
  }

  return {
    select: (packId) => resolverById.get(packId ?? "") ?? defaultResolver,
    list: () => [...packById.values()]
  };
}
