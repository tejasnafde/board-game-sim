# Testing Strategy

## Merge Gates

- Engine contract tests are mandatory.
- Game behavior tests are mandatory for each module.

## Contract Test Scenarios

1. Determinism for identical seed/action streams.
2. Illegal action rejection without state mutation.
3. Sequence guard on stale actions.
4. Hidden info redaction in player views.
5. Terminal freeze after game completion.

## Battleship Scenarios

1. Valid/invalid ship placement handling.
2. Turn ownership enforcement.
3. Hit/miss/sunk event behavior.
4. Duplicate shot behavior.
5. Win condition and terminal event.

## Reconnect Scenarios

1. Correct player-scoped sync after reconnect.
2. Snapshot + replay equals in-memory state hash.

## Environment Notes

- `tests/contract/ws-server.test.ts` is gated by `ALLOW_SOCKET_TESTS=1` because some sandboxed environments disallow opening listening sockets.
