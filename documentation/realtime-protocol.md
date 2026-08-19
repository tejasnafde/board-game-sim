# Realtime Protocol (WebSocket)

## Client -> Server

1. `session.join`
2. `action.submit`
3. `session.leave`
4. `chat.send` (optional)

## Server -> Client

1. `session.state_sync`
2. `session.action_accepted`
3. `session.action_rejected`
4. `session.state_patch`
5. `session.terminal`

## Envelope Rules

- `action.submit` includes `expectedSeq` and `clientActionId`.
- Stale sequence actions are rejected with reason code.
- All accepted actions increment server sequence by 1.
- `session.action_accepted` includes the accepted `seq`, the emitted domain
  `events`, and `actorPlayerId` when the server knows the acting seat. Clients
  use the actor to keep local and opponent feedback in the correct perspective.
- The web client retains the latest 20 accepted actions for bounded activity
  and result history. A fresh session join clears that history.
