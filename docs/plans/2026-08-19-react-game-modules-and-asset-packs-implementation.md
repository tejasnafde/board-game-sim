# React Game Modules and Asset Packs Implementation Plan

This plan implements the approved A-first, C-ready architecture. Each behavior
change follows red-green-refactor. Existing game rules and protocols remain
unchanged.

## Slice 1: Catalog Contract

1. Add failing tests for unique game IDs, lookup, playable listing, default pack
   identity, and catalog-derived hub metadata.
2. Introduce typed `GameClientManifest`, `GameClientModule`, and `GameCatalog`.
3. Register the three current modules explicitly.
4. Derive route adapter lookup and hub cards from the catalog.
5. Keep existing adapters behind the module interface during migration.

Acceptance: adding a fixture module requires one catalog registration and no
changes to routing, hub rendering, or browser app conditionals.

## Slice 2: Semantic Asset Packs

1. Add failing tests for role resolution, required-role validation, duplicate
   pack IDs, source metadata, theme variables, and fallback selection.
2. Introduce `AssetPack`, `AssetReference`, `AssetSource`, and `AssetResolver`.
3. Convert current presentation files into typed default packs without changing
   the rendered appearance.
4. Move Battleship-specific renderer wiring from shared runtime into the
   Battleship module.
5. Keep required and optional role behavior explicit.

Acceptance: shared runtime contains no ship, shot, maze, or disc vocabulary.

## Slice 3: Multi-Game Asset Build

1. Add a production-build test that checks emitted URLs for each game's pack.
2. Replace the Battleship-only Vite `publicDir` with an asset index backed by
   static imports or `import.meta.glob`.
3. Preserve the existing web-client public directory for discovery files.
4. Verify dev and production asset URLs through `AssetResolver`.

Acceptance: assets from any registered module enter the hashed Vite asset graph
without another Vite configuration edit.

## Slice 4: React Host

1. Add React, React DOM, and their TypeScript types at repository-compatible
   current versions.
2. Add failing controller tests for subscription notifications and cleanup.
3. Extend `ClientController` with `subscribe` and stable snapshots.
4. Create React `BrowserApp`, routing/session hooks, shell, hub, and lobby.
5. Add a temporary `LegacyGameHost` that preserves current adapter behavior.
6. Switch bootstrap to `createRoot` while keeping all browser journeys green.

Acceptance: React owns the application root and session lifecycle; all three
games still play through the authoritative server.

## Slice 5: Native React Game Views

Migrate in increasing complexity order:

1. Connect Four: board, controls, terminal state, and responsive tests.
2. Battleship: setup, placement interactions, naval board, and effects.
3. Labyrinth: tile rendering, insertion controls, movement, and activity feed.
4. Delete each legacy render/bind implementation as its React view lands.
5. Remove `LegacyGameHost` and the old `PlayableGameUiAdapter` interface.

Acceptance: every Game Client Module exposes a React `GameView`; no game emits
HTML strings or binds DOM listeners after render.

## Slice 6: Real Pack Switching

1. Add failing tests for selecting, persisting, and falling back between packs.
2. Define Battleship `sea-command` from the current CC0 art.
3. Define Battleship `classic-vector` from the existing local SVG assets.
4. Add a restrained appearance selector outside active gameplay.
5. Add a browser test that swaps packs without changing server state.

Acceptance: two Battleship pack adapters satisfy the same Visual Roles and can
be exchanged without editing the game view.

## Slice 7: Asset Quality and Licensing

1. Add `assets:validate` tests and command.
2. Validate paths, required roles, image metadata, SPDX identifiers, and source
   records; detect excessive transparent padding.
3. Generate a credits artifact and expose it in the web client.
4. Add curated Labyrinth CC0 assets and interaction audio only after visual
   comparison at desktop and mobile sizes.
5. Document asset acquisition, modification, and attribution policy.

Acceptance: CI rejects incomplete or unlicensed packs, and production exposes
accurate credits for every shipped external asset.

## Final Gates

- `npm test`
- `npm run typecheck`
- `npm run build:web`
- `npm run test:e2e`
- `/deslop` review against the branch base
- Production workflow and public smoke test after push
