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

5. Persistence
- Append-only `game_events` and periodic `game_snapshots`.

6. View Projection
- Produces redacted state per player.

## Runtime Flow

1. Client joins session.
2. Server emits `session.state_sync` with player-scoped view.
3. Client submits intent via `action.submit`.
4. Server sequence-checks and rule-validates action.
5. Server stores event, snapshots periodically, and broadcasts update.
6. Terminal check triggers `session.terminal` when complete.
