# Data Model

## Core Tables/Collections

- `sessions`
- `players`
- `game_events`
- `game_snapshots`
- `invites`
- `users`

## Event Strategy

- Append one immutable event per accepted action/effect.
- Include `seq`, actor, payload, and integrity hash context.

## Snapshot Strategy

- Persist full authoritative state every `N=10` events (default).
- Rebuild by loading latest snapshot + replaying tail events.

## Integrity

- Every accepted transition computes an integrity hash.
- Reconstructed state hash must match snapshot continuity checks.
