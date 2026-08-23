# Board Game Simulator

Browser-first, authoritative, turn-based board game platform.

## Workspace Layout

- `documentation/` architecture and collaboration specs
- `packages/shared` shared contracts and utilities
- `packages/engine` deterministic runtime core
- `packages/server` session runtime and protocol handling
- `packages/games/*` authoritative Battleship, Labyrinth, Connect Four, and Hex Kingdoms modules
- `packages/web-client` browser client skeleton
- `tests/` contract and game behavior test scaffolds

## Principles

- Server-authoritative state transitions
- Intent-based client actions
- Event log + snapshots for replay and recovery
- Per-player redacted views for hidden information

## Local Run (End-to-End)

1. Install dependencies:
`npm install`

2. Start backend:
`npm run dev:server`

3. Start web client (new terminal):
`npm run dev:web`

4. Open:
`http://127.0.0.1:5173`

Optional:
- Run both together: `npm run dev`
- Override websocket URL for frontend: `VITE_WS_URL=ws://127.0.0.1:8080/realtime npm run dev:web`

UI flow:
1. Landing: set `session` + `player`, click `Join Mission`.
2. Setup: click `Load Valid Fleet` (or `Randomize Fleet`), then `Submit Setup`.
3. Gameplay: click cells on `Opponent Board` when it is your turn.

## Credits

Game and UI icons by the [game-icons.net](https://game-icons.net) contributors
(Lorc, Delapouite, Caro Asercion, Cathelineau and others), licensed
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Battleship ship
sprites from the bundled sea-warfare asset set (see `assets/external/`).
