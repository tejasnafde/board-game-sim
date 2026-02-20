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
