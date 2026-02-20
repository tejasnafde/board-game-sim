# Game Module Specification

Each game module must implement:

- `initGame(input): InitResult`
- `listLegalActions(input): LegalAction[]`
- `applyAction(input): ApplyResult`
- `getPlayerView(input): PlayerView`
- `isTerminal(input): TerminalResult | null`

## Validation Guarantees

- `applyAction` must reject illegal actions deterministically.
- State transitions must be pure for a given `(state, action, seed)`.
- `getPlayerView` must not leak opponent hidden state.
- `isTerminal` must be monotonic once terminal condition is reached.

## Versioning

- Sessions are pinned to `gameId@version`.
- Breaking changes require a new game module version.

## Presentation Contract (Client)

- Each game should provide `presentation.json` alongside `definition.json`.
- `presentation.json` contains board render metadata, asset list, sprite/effect mappings, and theme tokens.
- `pieceSprites` and `effects` entries must reference valid asset IDs from `assets`.
