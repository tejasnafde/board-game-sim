# Board Game Simulator

Browser-first, authoritative, turn-based board game platform.

## Workspace Layout

- `documentation/` architecture and collaboration specs
- `packages/shared` shared contracts and utilities
- `packages/engine` deterministic runtime core
- `packages/server` session runtime and protocol handling
- `packages/games/battleship` first game module
- `packages/web-client` browser client skeleton
- `tests/` contract and game behavior test scaffolds

## Principles

- Server-authoritative state transitions
- Intent-based client actions
- Event log + snapshots for replay and recovery
- Per-player redacted views for hidden information
