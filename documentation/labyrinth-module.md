# Labyrinth Module

## Version

- `gameId`: `labyrinth`
- `version`: `0.1.0`

## Rules Model

- Authoritative game state lives on the server.
- Turn phases are split into staged actions:
1. Rotate the spare tile zero or more times with `rotate_spare`.
2. Insert it with `insert_tile`.
3. Move the pawn with `move_pawn`.
- Immediate reverse insertion is rejected (`reverse_insertion_forbidden`).
- Movement is constrained to graph-reachable cells based on tile openings.

## Action Contract

### `rotate_spare`

Payload:
- `rotationDeg`: absolute rotation, one of `0 | 90 | 180 | 270`

Validation:
- Actor must be current player.
- Game must be in `turnStage=insert`.
- Rotation must be one of the four supported right angles.

The action changes only the spare tile orientation. It does not advance the
turn stage. Emitted event: `spare.rotated`.

### `insert_tile`

Payload:
- `edge`: `"top" | "bottom" | "left" | "right"`
- `index`: insertion slot index (default legal slots are `1,3,5`)

Validation:
- Actor must be current player.
- Game must be in `turnStage=insert`.
- Slot must be legal for configured board.
- Action cannot reverse previous turn's insertion.

### `move_pawn`

Payload:
- `row`: number
- `col`: number

Validation:
- Actor must be current player.
- Game must be in `turnStage=move`.
- Destination must be in-bounds and reachable from current pawn location.

## Objective and Win Conditions

- Each player receives a private ordered objective queue.
- Objective is collected by ending `move_pawn` on the objective tile.
- A player finishes after all objectives are collected and they return home.
- Play continues for placement order until one unfinished player remains. The
  first player in `finishOrder` is the winner.

## Player View Redaction

`getPlayerView` includes:
- Public board and pawn positions.
- Public objective progress counts for all players.
- Full objective queue only for the requesting player (`myState.remainingObjectives`).
- Current objective coordinates are derived from the authoritative board and
  are `null` while that objective is on the spare tile.

Opponent private objective queues are never exposed.
