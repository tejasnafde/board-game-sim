# Web Client

`packages/web-client` now contains playable browser flows for Battleship and Labyrinth.

## Modules

- `realtime-client.ts`: websocket transport abstraction.
- `realtime-state.ts`: client-side event reducer and action envelope builder.
- `client-controller.ts`: join/rejoin plus generic `submitAction` API (with Battleship helpers preserved).
- `runtime.ts`: binds presentation definition, asset manager, renderer, and controller.
- `browser-app.ts`: route-aware shell and session host; it has no game-specific render or event knowledge.
- `game-adapters/playable-game-ui.ts`: the shared Playable Game UI adapter interface.
- `game-adapters/<game>/index.ts`: adapter implementation that owns that game's screens, rendering, event binding, and ephemeral UI state.
- `game-adapters/index.ts`: creates the current adapter set and their runtimes.
- `grid-renderer.ts`: default renderer for grid board games.

## Screens

- Landing: game hub with playable entries.
- Battleship: session lobby, fleet setup, and turn-based firing board.
- Labyrinth: session lobby, spare-tile insertion controls, and reachable-cell pawn movement.

## Runtime Flow

1. UI joins a session with `session.join`.
2. Server sends `session.state_sync` and subsequent realtime events.
3. Reducer updates local client state from server events.
4. Controller submits intents with `expectedSeq` from local state (`submitAction` or game-specific wrappers).
5. UI reflects `action_rejected` and terminal events.

## Integrating in Browser

Use `initPlayableWebClient(root, websocketFactory)` from `packages/web-client/src/index.ts`.
The websocket factory should return an object compatible with `SocketLike`.

## External Free Assets

- Current Battleship art uses OpenGameArt \"Sea Warfare Set\" (CC0):
  https://opengameart.org/content/sea-warfare-set-ships-and-more
- Repository copy and attribution are stored in:
  `packages/games/battleship/assets/external/sea-warfare-set/`
