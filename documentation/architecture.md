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
- `AssetManager` resolves per-game asset IDs to URLs.
- `RendererRegistry` maps board type (`grid`/`hex`/`graph`) to concrete renderer implementation.
- `RealtimeClient` transports websocket protocol events.
- `ClientController` maps UI interactions to intent submissions using sequence-safe envelopes and generic `submitAction(actionType, payload)` support.
- `browser-app.ts` is the shared shell and session host. It owns routing, transport, identity persistence, and session lifecycle.
- Each Playable Game UI adapter owns screen selection, rendering, event binding, and ephemeral UI state behind one interface.
- `game-adapters/index.ts` creates the three real adapters (`battleship`, `labyrinth`, `connect4`) and their runtimes.
- `ClientState` reducer applies `state_sync`, `action_accepted/rejected`, `state_patch`, and `terminal` events.

## Runtime Flow

1. Client joins session.
2. Server emits `session.state_sync` with player-scoped view.
3. Client submits intent via `action.submit`.
4. Server sequence-checks and rule-validates action.
5. Server stores event, snapshots periodically, and broadcasts update.
6. Terminal check triggers `session.terminal` when complete.
