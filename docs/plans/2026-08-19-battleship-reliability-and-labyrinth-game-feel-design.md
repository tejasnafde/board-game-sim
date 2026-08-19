# Battleship Reliability and Labyrinth Game Feel

## Outcome

Make Battleship trustworthy through a complete match and make Labyrinth feel
like a tactile board game with meaningful insertion choices. Connect Four is
already stable and remains unchanged.

## Evidence

A production Battleship match reached terminal state with valid board geometry,
100 unique coordinates per board, and no hidden unsunk sprites. It also exposed
an action-perspective defect: `session.action_accepted` carries events but not
the acting seat. A bot response therefore replaces the human salvo result and
can describe damage from the wrong perspective.

Labyrinth is mechanically stable, but it omits spare-tile rotation, a core
source of agency in the board game. The React view also shows the post-action
state without clearly previewing or animating the lane shift and pawn journey.

## Battleship Action Perspective

`session.action_accepted` gains an optional `actorPlayerId`. The server emits it
for human and bot actions. Keeping the field optional makes the protocol change
additive for older clients, while current clients and tests require the server
to populate it.

The client reducer keeps a bounded list of accepted action records containing
sequence, actor, and events. Battleship derives two independent summaries:

- **Outgoing salvo**: the local player's latest shot.
- **Incoming fire**: the opponent's latest shot against the local fleet.

Hit, miss, and sunk language is written from the correct perspective. A bot
reply no longer erases the player's result. Terminal presentation prioritizes
the match outcome and does not present stale action feedback as the result.

## Labyrinth Rule Change

Add a `rotate_spare` intent that is legal only for the current player during the
insert stage. Its payload selects one of the four valid absolute rotations.
The server rotates the spare tile, emits `spare.rotated`, advances sequence, and
otherwise leaves the turn in the insert stage. Invalid rotations and attempts
during move or terminal stages are safely rejected.

The bot evaluates every legal insertion at every spare-tile rotation. If its
best move needs another orientation, it rotates first and inserts on the next
bot action. All evaluation remains deterministic under the supplied seeded RNG.

## Labyrinth Interaction Design

The spare tile becomes a compact physical control with clockwise and
counter-clockwise rotation buttons. Its current orientation is immediately
visible and remains server-confirmed.

Hovering or focusing an insertion arrow previews the resulting maze without
submitting an action. The affected lane is emphasized, the ejected tile is
identified, and the player's projected reachable region is shown. Clicking the
arrow submits the existing `insert_tile` intent.

After confirmation, the shifted lane moves briefly in the insertion direction.
Pawn movement follows the selected path instead of teleporting. Both effects
use short, interruptible transforms and are disabled under reduced motion.

The current objective becomes a board-level beacon with its name, location,
and reachable/unreachable state. Upcoming objectives remain secondary. Recent
activity persists across several accepted actions instead of showing only the
latest transport event.

The visual direction stays within the existing studio-technical shell, but the
maze itself gains tactile tile depth, clearer corridor hierarchy, stronger
player pieces, and restrained board texture. This pass does not add power-ups,
random events, audio, or a new visual theme.

## Data Flow and Authority

The server remains authoritative. Rotation and insertion clicks submit intents;
the client never patches game state. Insertion preview uses a pure local
simulation of the current player view and cannot commit or reveal hidden data.
The confirmed view replaces the preview after every accepted action or sync.

## Error Handling

- Unknown or missing action actors render neutral feedback instead of guessing.
- Invalid spare rotations return stable reason codes and leave state unchanged.
- Preview failure falls back to the confirmed board with controls still usable.
- Pending rotation, insertion, and movement disable conflicting controls.
- Reconnect state is derived entirely from the latest server view and accepted
  action history may restart empty without affecting playability.

## Testing

- Protocol and gateway tests require actor identity for human and bot actions.
- Reducer tests cover bounded accepted-action history and session reset.
- Battleship view tests cover outgoing/incoming hit, miss, sunk, and terminal
  wording from both seats.
- Battleship browser E2E plays a full bot match and checks coordinate uniqueness,
  hidden-information presentation, action perspective, and terminal state.
- Labyrinth rule tests cover legal rotation, invalid timing and values,
  determinism, and insertion using the rotated openings.
- Labyrinth bot and self-play tests must still reach terminal state.
- React tests cover rotation controls, insertion preview, objective beacon,
  pending states, and reduced-motion semantics.
- Browser E2E covers several rotate-insert-move turns, two-player handoff,
  mobile containment, and terminal completion.

## Acceptance

A player can finish Battleship without contradictory salvo feedback. A
Labyrinth turn offers an intelligible sequence—orient the spare tile, preview a
lane, insert it, then follow a visible path—and every state-changing step is
validated by the authoritative server.
