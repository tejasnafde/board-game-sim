# Web Client

`packages/web-client` now contains a playable browser-oriented Battleship client skeleton.

## Modules

- `realtime-client.ts`: websocket transport abstraction.
- `realtime-state.ts`: client-side event reducer and action envelope builder.
- `client-controller.ts`: join/rejoin/setup/fire intent API.
- `runtime.ts`: binds presentation definition, asset manager, renderer, and controller.
- `browser-app.ts`: minimal interactive UI mount function.
- `grid-renderer.ts`: default renderer for grid board games.

## Runtime Flow

1. UI joins a session with `session.join`.
2. Server sends `session.state_sync` and subsequent realtime events.
3. Reducer updates local client state from server events.
4. Controller submits intents with `expectedSeq` from local state.
5. UI reflects `action_rejected` and terminal events.

## Integrating in Browser

Use `initPlayableWebClient(root, websocketFactory)` from `packages/web-client/src/index.ts`.
The websocket factory should return an object compatible with `SocketLike`.
