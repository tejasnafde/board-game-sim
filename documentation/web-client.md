# Web Client

`packages/web-client` contains playable browser flows for Battleship,
Labyrinth, Connect Four, and Hex Kingdoms.

## Modules

- `registered-games.ts`: the single audited game catalog. Hub metadata,
  playability, and adapter factories derive from these entries.
- `game-catalog.ts`: validates and indexes client modules without game-specific
  route or shell knowledge.
- `asset-pack.ts`: validates semantic visual roles, emitted file URLs, theme
  variables, and source credits.
- `game-assets/<game>.ts`: owns a game's compatible visual packs and static Vite
  asset imports.
- `react-app.tsx`: React application mount and lifecycle boundary.
- `realtime-client.ts`: websocket transport abstraction.
- `realtime-state.ts`: client-side event reducer and action envelope builder.
- `client-controller.ts`: join/rejoin plus generic `submitAction` API (with Battleship helpers preserved).
- `runtime.ts`: binds presentation, controller, and a renderer supplied by the
  game module. Shared runtime code contains no ship or shot vocabulary.
- `browser-app.ts`: route-aware shell and session host; it has no game-specific render or event knowledge.
- `game-adapters/playable-game-ui.ts`: the shared Playable Game UI adapter interface.
- `game-adapters/react-game-ui-adapter.ts`: the reusable React root lifecycle,
  static-lobby handoff, and native-view host.
- `game-adapters/<game>/index.ts`: a thin controller-to-component adapter that
  validates interaction timing and submits server intents.
- `game-adapters/<game>/game-view.tsx`: typed, declarative setup and gameplay UI.
- `game-adapters/index.ts`: derives the playable adapter map from the catalog.
- `grid-renderer.ts`: default renderer for grid board games.
- `components/hex-board.tsx`: responsive axial geometry with accessible input targets.
- `components/card-zone.tsx`: reusable visible/hidden card and tile collections.

## Screens

- Landing: game hub with playable entries.
- Battleship: session lobby, fleet setup, and turn-based firing board.
- Labyrinth: mixed human/computer table lobby, spare-tile insertion controls,
  one-at-a-time private objectives, collected-treasure trophies, and
  reachable-cell pawn movement.
- Connect Four: session lobby, column controls, and a tactile drop board.
- Hex Kingdoms: mixed table lobby, tile market, interactive territory map,
  score projection, and final kingdom ledger.

Battleship and Connect Four default to a server-backed computer game.
Labyrinth and Hex Kingdoms expose human and computer seat counts separately; their boards remain
locked until every selected human seat joins.

## Adding a Playable Game

1. Add its server-side definition, rules, bot, contract tests, and self-play
   entry as required by the repository rules.
2. Add a typed React game view, its thin controller adapter, and any semantic
   asset packs. Use `createReactGameUiAdapter` for the lobby/view boundary.
3. Register one entry in `registered-games.ts`.

The hub, hash route, session defaults, and adapter lookup require no separate
game-specific edit.

## Visual Packs

Visuals resolve through roles such as `piece.carrier` and `effect.shot.hit`.
Rendering metadata records the source art's native facing so packs can swap
horizontal and vertical sprites without special-case rotations. Battleship's
appearance selector persists the chosen pack locally and reloads presentation
only; authoritative server state is unchanged.

## Runtime Flow

1. UI creates a session with a canonical table plan or joins an existing code.
2. Server sends `session.state_sync`, including authoritative seat readiness,
   and subsequent realtime events.
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
- Approved CC0 sources for future game-specific additions:
  - Kenney Board Game Pack: https://kenney.nl/assets/boardgame-pack
  - Kenney Board Game Icons: https://kenney.nl/assets/board-game-icons

External packs are evaluated asset by asset. A CC0 license is necessary, but the art must also match the game's established visual language and earn the added bundle weight.
