# Labyrinth Mixed Tables and Hidden Objectives

## Outcome

Let a creator reserve human and AI seats explicitly, prevent unclaimed seats
from deadlocking play, and make Labyrinth objectives genuinely secret. A table
such as two humans plus one AI must wait for both humans, then play through the
same authoritative turn loop as every other roster.

The maze displays all 24 treasure items. Each player receives three ordered
targets, but their client sees only the current target. Unassigned items and
targets reserved for later are indistinguishable decoys on the public board.

## Table Configuration

The Labyrinth lobby replaces the mutually exclusive computer/private modes
with two counts:

- Human players: one to four.
- AI players: zero to three.

Their sum must be between two and four. The lobby summarizes the selection,
for example, `3-player table · 2 humans · 1 computer`.

The creation protocol adds `humanSeats` while retaining `bots` as the AI count.
The server derives the total engine roster from their sum. Existing
`seatCount` callers remain supported through a compatibility adapter, but new
callers use the explicit split.

## Seat Ownership Module

Introduce a table-roster module at the seam between realtime session handling
and the game engine. Its interface accepts a table plan, claims a human seat,
reports readiness, exposes display names, and returns the bot-controlled seat
IDs. It owns every fact about seat control so the gateway, WebSocket transport,
rematch UI, and tests do not each reconstruct mixed-table rules.

Engine player IDs remain stable generic seats such as `player-1`. The first
`humanSeats` positions are reserved for humans and the final `bots` positions
are controlled by the server. The creator claims the first human seat. Bot
display names are assigned directly to their reserved seats and never pass
through human seat claiming.

Human joins can claim only unclaimed human seats. A reconnect using the same
name returns to the same seat. A new human is rejected when all human seats are
claimed even if bot seats exist. Bot seats cannot later be replaced by humans.

## Readiness and Realtime Flow

Creating the engine session does not make the table playable. The table is
ready only when every reserved human seat has been claimed.

Before readiness:

- The gateway rejects gameplay intents with `table_not_ready`.
- The bot loop does not run.
- Player views may render the board, but all game controls remain disabled.
- The status identifies the number of humans still expected.

`session.state_sync` gains an additive table summary containing human count,
AI count, claimed-human count, and readiness. When a human joins or reconnects,
the WebSocket room broadcasts fresh personalized state syncs to every
connection. The final human claim therefore unlocks existing clients without
requiring a refresh or dummy action.

Once ready, the existing server-authoritative action flow is unchanged. Bots
act only for their reserved seats. Rematch creation reuses the table summary,
preserving the human/AI split rather than inferring bots from display names.

## Objective Population

Initialization places every unique item in `objectiveCatalog` on a different
non-home tile. With the current definition this means 24 public treasures on a
49-tile board. Initialization fails if the catalog cannot fit into the
available non-home slots.

The seeded game RNG deterministically shuffles both treasure positions and the
catalog used for target assignment. Each player receives
`objectivesPerPlayer` unique IDs. Across two, three, and four player games this
assigns 6, 9, or 12 of the 24 visible treasures; every remaining treasure is a
true decoy.

The authoritative player state retains the full ordered objective queue.
Collection continues to compare only the tile under the pawn with the first
queue item. Landing on a future target, another player's target, or an
unassigned decoy has no effect.

## Player View and Hidden Information

The requesting player view replaces `remainingObjectives` with:

```ts
currentObjective: {
  id: string;
  position: Coord | null;
} | null
objectivesRemainingCount: number
```

`position` is null when the target tile is currently the spare. No future
player-to-objective mapping or queue order crosses `getPlayerView`. Future
target IDs and positions still exist as ordinary public treasure tiles, where
they are indistinguishable from other players' targets and decoys. Opponent
views continue to expose only progress counts and collected public history.

Collecting an objective emits the existing public `objective.collected` event.
The event stream does not emit the next objective ID; the next personalized
state sync privately reveals it to the collecting player. Bots also receive
only `currentObjective` and must remain capable of reaching terminal state
from that same view.

## Labyrinth UI

The lobby uses paired count controls with invalid combinations disabled. The
summary and start button make the resulting table composition explicit.

While waiting, the game view shows `Waiting for 1 human player` and lists the
reserved human and computer seats. Rotation, insertion, and movement controls
remain disabled.

The objective rail contains one prominent current-target card. It never
renders faded second or third objectives. After collection, the next confirmed
player view replaces the card with the newly revealed target. The public board
continues to render every treasure identically; only the local player's current
target receives the private beacon treatment.

## Error Handling

- Invalid human/AI totals are rejected with `invalid_table_plan`.
- Human joins after all reserved human seats are claimed return
  `session_full`.
- Gameplay before readiness returns `table_not_ready` without advancing
  sequence or mutating game state.
- Reconnect is idempotent for an already claimed player name.
- Missing or oversized objective catalogs fail initialization instead of
  silently omitting or duplicating treasure IDs.
- A current objective on the spare renders without a board coordinate and
  remains collectable only after it returns to the board.

## Testing

### Table roster and protocol

- Unit tests cover valid table plans, reserved human claims, reserved bot
  seats, reconnects, readiness, and full-table rejection.
- Gateway contract tests prove bots never claim human seats, actions are
  rejected before readiness, and the bot loop begins only after the final
  human joins.
- Realtime tests require room-wide readiness sync and additive table metadata.
- Rematch tests require the original human/AI split.

### Objective secrecy and decoys

- Rule tests require 24 unique public treasures across two-, three-, and
  four-player initializations.
- Assigned objective IDs are unique subsets of the public treasures and leave
  the expected decoy count.
- Player-view contract tests prove `myState` exposes only the current objective
  and contains no future queue or player-to-objective assignments. Public board
  tiles remain visible without identifying which ones are future targets.
- Behavior tests prove landing on decoys or future objectives does not collect
  them and collecting the current target reveals the next only in the next
  private view.
- Determinism tests cover treasure placement and target ordering.
- Bot and self-play tests continue to reach terminal using only the redacted
  view.

### Browser coverage

- A two-human plus one-AI Labyrinth test verifies the waiting state, second
  human join, bot turn, human handoff, and absence of deadlock.
- Lobby tests cover valid combinations and table summaries.
- Game-view tests assert that only one private objective card is rendered while
  all 24 public treasures remain visible.

## Acceptance

A creator can start a two-human plus one-AI table, share the code, and wait for
the second human without any bot taking that seat or any turn becoming stuck.
After the second human joins, all three controllers participate and rematches
retain the same composition.

During play, the board shows 24 plausible treasures while each player knows
only the one they currently need. Neither the client, diagnostics, nor the bot
can inspect later targets, and complete deterministic games still reach a
terminal result.
