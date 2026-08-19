export type GameClientManifest = {
  gameId: string;
  version: string;
  title: string;
  summary: string;
  status: "live" | "coming-soon";
  releaseTag: string;
  players: string;
  turnStyle: string;
  defaultAssetPackId: string;
};

export type GameCatalogEntry<TClient = unknown> = {
  manifest: GameClientManifest;
  client?: TClient;
};

export type GameCatalog<TEntry extends GameCatalogEntry = GameCatalogEntry> = {
  resolve(gameId: string): TEntry | undefined;
  resolvePlayable(gameId: string): TEntry | undefined;
  list(): TEntry[];
  listPlayable(): TEntry[];
};

export function createGameCatalog<TEntry extends GameCatalogEntry>(entries: TEntry[]): GameCatalog<TEntry> {
  const entryById = new Map<string, TEntry>();
  for (const entry of entries) {
    const gameId = entry.manifest.gameId;
    if (entryById.has(gameId)) {
      throw new Error(`duplicate_game_id:${gameId}`);
    }
    entryById.set(gameId, entry);
  }

  const playable = entries.filter((entry) => entry.manifest.status === "live");

  return {
    resolve: (gameId) => entryById.get(gameId),
    resolvePlayable: (gameId) => {
      const entry = entryById.get(gameId);
      return entry?.manifest.status === "live" ? entry : undefined;
    },
    list: () => [...entries],
    listPlayable: () => [...playable]
  };
}
