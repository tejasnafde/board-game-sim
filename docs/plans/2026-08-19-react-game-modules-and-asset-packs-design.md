# React Game Modules and Asset Packs

Status: approved

## Decision

Keep Vite and the existing Cloudflare Pages plus Cloud Run deployment. Adopt
React for the browser UI. Prioritize making a fourth game cheap to add, while
building asset packs as a real swappable seam with at least two implementations.

The server remains authoritative. This design changes presentation and client
composition only; rules, intents, player views, replay, and session version
pinning remain unchanged.

## Problems to Solve

The current client has useful game-specific UI adapters, but shared modules
still know about individual games:

- the runtime maps Battleship ships and shot effects into `GridRenderer`;
- Vite serves the Battleship package as the single public asset directory;
- adapter creation and route selection enumerate games manually;
- manifests expose `definition` and `presentation` as `unknown`;
- UI adapters render HTML strings and bind DOM events after every render.

These choices make a fourth game touch the runtime, routing, hub, build config,
and presentation code even when none of those modules should understand it.

## Canonical Terms

- **Game Client Module**: the client-side entry for one `gameId@version`. It
  supplies catalog metadata, its React game view, rule-definition data, and its
  compatible asset packs.
- **Game Catalog**: the deep module that validates and indexes Game Client
  Modules. The shell uses only this interface to list and resolve games.
- **Visual Role**: a semantic asset key such as `piece.carrier`,
  `effect.shot.hit`, or `surface.maze.floor`.
- **Asset Pack**: a versioned mapping from a game's Visual Roles to files,
  rendering metadata, theme tokens, and license sources.
- **Asset Resolver**: the deep module that validates an Asset Pack and resolves
  Visual Roles to browser URLs and rendering metadata.

## Target Architecture

```text
BrowserApp
  ├── GameCatalog ──> GameClientModule
  │                     ├── GameView (React)
  │                     ├── definition
  │                     └── compatible AssetPacks
  ├── SessionStore ──> ClientController ──> realtime transport
  └── AssetResolver ──> selected AssetPack ──> Vite asset graph
```

### Game Client Module

```ts
type GameClientModule = {
  manifest: {
    gameId: string;
    version: string;
    title: string;
    summary: string;
    playerRange: { min: number; max: number };
    defaultAssetPackId: string;
  };
  definition: unknown;
  assetPacks: readonly AssetPack[];
  requiredVisualRoles: readonly string[];
  GameView: React.ComponentType<GameViewProps>;
};
```

The shell does not import individual game adapters. A single explicit catalog
file registers modules for auditability and deterministic bundles. Adding a
game changes the catalog once; routing, the hub, session defaults, and adapter
selection derive from it.

### Asset Pack and Resolver

```ts
type AssetPack = {
  gameId: string;
  packId: string;
  version: string;
  roles: Record<string, AssetReference>;
  theme: Record<string, string>;
  sources: readonly AssetSource[];
};

type AssetResolver = {
  resolve(role: string): ResolvedAsset;
  themeVariables(): Record<string, string>;
  credits(): readonly AssetCredit[];
};
```

`AssetReference` carries file identity plus presentation facts the renderer
cannot infer safely: native facing, fit, anchor, repeat mode, and allowed bleed.
Game modules declare required roles. Pack construction fails early when a role,
file, source, or license is missing.

Vite imports all pack files into its asset graph so production receives hashed
URLs. The existing Battleship-only `publicDir` is removed. Files that must keep
fixed names, such as `robots.txt`, remain in the web client's real public
directory.

### React Host

React owns the application shell, lobby, session lifecycle, and game view.
`ClientController` gains a `subscribe` interface compatible with
`useSyncExternalStore`; its implementation remains framework-independent.
Game views receive a stable session snapshot and action functions. They submit
intents only and never patch gameplay state.

The migration is incremental. A temporary legacy host can mount an existing UI
adapter while its game is converted, but it is deleted when the third game is
native React. The target interface contains no HTML-string rendering or manual
post-render event binding.

## Asset Strategy

Each game has one coherent default pack rather than a mix of unrelated art.

- Battleship keeps its current CC0 naval set initially, with normalized bounds,
  explicit facing metadata, improved water/effects, and audio. Its existing
  local SVG set becomes a second `classic-vector` pack that proves swapping.
- Labyrinth adopts a cohesive CC0 tabletop/dungeon pack after the foundation is
  stable. Rotatable corridor geometry stays code-rendered; textures, objectives,
  pawns, and feedback come from the pack.
- Connect Four keeps its board and discs procedural. Its pack supplies theme
  tokens and interaction audio instead of decorative bitmap art.

Every external source is recorded once with SPDX license identifier, author,
source URL, and local notice path. CC0 is preferred. CC-BY is allowed only when
the credits generator and public credits screen cover it.

## Failure Modes

- Duplicate game IDs fail catalog construction.
- Duplicate pack IDs, mismatched game IDs, unknown roles, missing sources, and
  missing files fail asset validation.
- A stored pack that no longer exists falls back to the module's default pack.
- A game module whose default pack cannot satisfy required roles does not enter
  the playable catalog.
- Missing optional assets degrade to code-rendered visuals; required assets do
  not silently disappear.

## Testing

- Contract tests exercise Game Catalog and Asset Resolver interfaces.
- Every registered module must have a valid default pack and unique identity.
- Every pack must resolve required roles and produce complete credits.
- React view tests cover lobby and gameplay transitions from server snapshots.
- Existing self-play tests remain the playability gate.
- Browser tests continue to cover all three games and add pack switching.
- Production build tests verify that assets for every game are emitted and
  reachable, preventing a return to the Battleship-only public directory.

## Migration Order

1. Introduce typed Game Catalog, Asset Pack, and Asset Resolver modules without
   changing visuals.
2. Move existing presentations into default packs and make Vite emit assets for
   every game.
3. Add React, a session store, and the React application shell.
4. Migrate Connect Four, Battleship, then Labyrinth to native React views.
5. Delete the legacy adapter host and HTML-string binding interface.
6. Add Battleship's second pack and persisted pack selection.
7. Add license validation, generated credits, curated Labyrinth art, and audio.

The ordering favors new-game extensibility first. Theme switching becomes real
only after two packs exist, satisfying the rule that a seam needs two adapters.

## Non-Goals

- Moving gameplay authority into React or the browser.
- Replacing the WebSocket server with Next.js handlers.
- Building a universal declarative UI language.
- Loading unsigned asset packs from arbitrary remote URLs.
- Adding WebGL or a 3D engine during this migration.
