# Testing Strategy

## Merge Gates

- Engine contract tests are mandatory.
- Game behavior tests are mandatory for each module.
- Every game bot must reach terminal state through the full gateway and player-view boundary.
- New games must pass every supported product human/bot split and synthetic all-bot seat count.

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

## Full-Session Playtests

1. Policies receive only personalized production views.
2. Every view serializes at every sequence and no nonterminal state deadlocks.
3. Accepted sequence numbers are monotonic and terminal state rejects further actions.
4. Hex Kingdoms runs all 2–4 seat product splits plus deterministic balance soaks.
5. Signal Crew runs all 2–4 seat product splits, hidden-view assertions, and
   deterministic difficulty soaks.
6. The five-game matrix exercises supported all-computer and human/computer
   compositions through terminal state.

## Web Client Scenarios

1. Realtime reducer handles sync/patch/reject/terminal transitions.
2. Controller submits sequence-safe intent envelopes.
3. Runtime wires presentation, assets, renderer, and transport.
4. Rejoin behavior reuses cached session identity.

## Environment Notes

- `tests/contract/ws-server.test.ts` is gated by `ALLOW_SOCKET_TESTS=1` because some sandboxed environments disallow opening listening sockets.
