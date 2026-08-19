# Architecture

## Components

1. Gateway/API
- Lobby/session creation, invites, identity lifecycle.

2. Realtime Session Runtime
- Room membership, sequencing, action intake, authoritative state updates.

3. Engine Core
- Contract enforcement, deterministic transitions, turn/phase helpers.

4. Game Registry
- Resolves `gameId@version` to definition + module.
- Built-in registration now includes `battleship@0.1.0` and `labyrinth@0.1.0`.
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
- `RendererRegistry` maps board type (`grid`/`hex`/`graph`) to concrete renderer implementation.
- `RealtimeClient` transports websocket protocol events.
- `ClientController` maps UI interactions to intent submissions using sequence-safe envelopes and generic `submitAction(actionType, payload)` support.
- React owns the browser mount and cleanup. `browser-app.ts` remains the shared
  session host during the incremental native-view migration.
- Each Playable Game UI adapter owns screen selection, rendering, event binding, and ephemeral UI state behind one interface.
- `registered-games.ts` is the single explicit registration point for the three
  playable clients and roadmap entries. The adapter map is derived from it.
- Battleship proves the asset-pack seam with `sea-command` and
  `classic-vector`; the selected pack is persisted without touching game state.
- `ClientState` reducer applies `state_sync`, `action_accepted/rejected`, `state_patch`, and `terminal` events.

## Runtime Flow

1. Client joins session.
2. Server emits `session.state_sync` with player-scoped view.
3. Client submits intent via `action.submit`.
4. Server sequence-checks and rule-validates action.
5. Server stores event, snapshots periodically, and broadcasts update.
6. Terminal check triggers `session.terminal` when complete.
