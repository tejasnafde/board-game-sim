# Realtime Protocol (WebSocket)

## Client -> Server

1. `session.create`
2. `session.join`
3. `action.submit`
4. `session.leave`
5. `chat.send` (optional)

## Server -> Client

1. `session.state_sync`
2. `session.action_accepted`
3. `session.action_rejected`
4. `session.terminal`

## Envelope Rules

- `action.submit` includes `expectedSeq` and `clientActionId`.
- `session.create.tablePlan` declares authoritative `humanSeats` and
  `botSeats`. Human seats are reserved at the front of the engine roster and
  bot seats at the back. The table accepts no gameplay actions until every
  human seat is claimed.
- `session.state_sync.table` reports `humanSeats`, `botSeats`,
  `claimedHumanSeats`, and `ready`. Room members receive personalized syncs
  when another human joins, so a waiting client unlocks without reconnecting.
- Stale sequence actions are rejected with reason code.
- All accepted actions increment server sequence by 1.
- `session.action_accepted` includes the accepted `seq`, the emitted domain
  `events`, and `actorPlayerId` when the server knows the acting seat. Clients
  use the actor to keep local and opponent feedback in the correct perspective.
- The web client retains the latest 20 accepted actions for bounded activity
  and result history. A fresh session join clears that history.
- Canonical integrity hashes remain inside the engine and persistence layers;
  they are never sent to clients because they can reveal information about
  hidden authoritative state.
