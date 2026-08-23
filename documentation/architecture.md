# Architecture

## Components

1. Gateway/API
- Lobby/session creation, invites, identity lifecycle.

2. Realtime Session Runtime
- Room membership, sequencing, action intake, authoritative state updates.
- `TableRoster` owns canonical human/computer seat reservation, name claims,
  and readiness. The realtime gateway blocks actions and bot pacing until the
  roster is ready.

3. Engine Core
- Contract enforcement, deterministic transitions, turn/phase helpers.

4. Game Registry
- Resolves `gameId@version` to definition + module.
- The immutable built-in catalog currently registers Battleship, Labyrinth,
  Connect Four, Hex Kingdoms, and Signal Crew with their definitions, modules,
  bots, and supported seat ranges.
- Presentation metadata (`presentation.json`) is loaded by the web client for render mappings and assets.

5. Persistence
- Append-only `game_events` and periodic `game_snapshots`.

6. View Projection
- Produces redacted state per player.

7. Client Rendering Layer
- `GameCatalog` validates unique game IDs and is the source for hub cards,
  playable routes, and client-module creation.
- `AssetResolver` maps semantic visual roles to Vite-managed URLs, orientation
  metadata, theme variables, and license credits.
- `AssetManager` remains as compatibility for presentation files while game
  adapters migrate to semantic asset roles.
- Presentation boards support `grid`, `hex`, `graph`, and boardless `none`
  contracts. React-owned games can omit a legacy string renderer; Battleship's
  runtime subtype guarantees its grid renderer is present.
- `RealtimeClient` transports websocket protocol events.
- `ClientController` maps UI interactions to intent submissions using sequence-safe envelopes and generic `submitAction(actionType, payload)` support.
- React owns each playable game view and subscribes directly to controller
  state. `browser-app.ts` remains the shared route, lobby, and session host.
- `createReactGameUiAdapter` owns the React root lifecycle for every game.
  Per-game adapters provide a static lobby and a typed game component, keeping
  mount, unmount, rematch, logging, and realtime behavior out of new games.
- Battleship, Labyrinth, Connect Four, Hex Kingdoms, and Signal Crew use
  declarative React interactions; their adapters submit intents and never
  patch authoritative game state.
- `registered-games.ts` is the single explicit registration point for the five
  playable clients and roadmap entries. The adapter map is derived from it.
- Battleship proves the asset-pack seam with `sea-command` and
  `classic-vector`; the selected pack is persisted without touching game state.
- `ClientState` reducer applies `state_sync`, including authoritative table
  readiness, plus `action_accepted/rejected` and `terminal` events. Canonical
  integrity hashes remain server-only.

## Runtime Flow

1. Client joins session.
2. Server emits `session.state_sync` with player-scoped view.
3. Client submits intent via `action.submit`.
4. Server sequence-checks and rule-validates action.
5. Server stores event, snapshots periodically, and broadcasts update.
6. Terminal check triggers `session.terminal` when complete.
