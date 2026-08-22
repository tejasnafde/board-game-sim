# Labyrinth Mixed Tables and Hidden Objectives Implementation Plan

This plan implements the approved design in independently testable slices.
Every behavior change follows red-green-refactor. The engine continues to use
stable seat IDs, the server remains authoritative, and bots continue to act
from player views only.

## Slice 1: Canonical Table Contracts

Files:

- `packages/shared/src/types/contracts.ts`
- `packages/server/src/table-roster.ts` (new)
- `packages/server/src/index.ts`
- `tests/contract/table-roster.test.ts` (new)

1. Add failing tests for valid plans, invalid totals, deterministic seat
   reservation, human claims, bot seats, reconnects, readiness, display names,
   and rejection after all human seats are claimed.
2. Add shared `TablePlan` and `TableSummary` types. `TablePlan` contains
   `humanSeats` and `botSeats`; `TableSummary` adds `claimedHumanSeats` and
   `ready`.
3. Implement a concrete `TableRoster` module. Do not add a one-implementation
   adapter interface. Its public interface should create a roster, claim a
   human, report its summary, return seat names, and return bot seat IDs.
4. Reserve the first seats for humans and final seats for bots. Assign bot
   display names directly rather than routing them through human claiming.
5. Add a compatibility normalizer for existing `seatCount` and `bots` creation
   fields. New callers produce a canonical `TablePlan` before reaching roster
   logic.

Acceptance: all seat ownership and readiness behavior is exercised through the
`TableRoster` interface; no caller needs to understand claim-map internals.

## Slice 2: Gateway Readiness and Bot Ownership

Files:

- `packages/server/src/protocol.ts`
- `packages/server/src/realtime-gateway.ts`
- `tests/contract/realtime-gateway.test.ts`

1. Add failing gateway tests for a two-human plus one-bot session:
   - three stable engine seats are created;
   - creator claims the first human seat;
   - bot owns the final seat;
   - the second human claims the remaining human seat;
   - a third human receives `session_full`.
2. Add failing tests proving gameplay before readiness returns
   `table_not_ready`, does not advance sequence, and cannot trigger bots.
3. Extend `session.create` with an optional canonical `tablePlan`, while still
   accepting legacy `seatCount` and `bots` fields during normalization.
4. Replace `claimsBySession` and `botSeatsBySession` with `TableRoster` calls.
   Keep the game ID associated with a created table so bot lookup remains
   local to the gateway.
5. Gate human actions and `playBotSeats` on table readiness.
6. Include `TableSummary` in every `session.state_sync` and use roster-owned
   display names for `seats`.
7. Lazily register sessions created directly by contract fixtures as all-human
   legacy tables so existing engine/session tests remain valid.

Acceptance: bot seats can never consume human reservations, and no authoritative
state change occurs before the selected humans have joined.

## Slice 3: Room-Wide Join Synchronization

Files:

- `packages/server/src/ws-server.ts`
- `tests/contract/ws-server.test.ts`

1. Add a failing socket test with two clients where the creator first receives
   `ready=false`, the second human joins, and both clients then receive
   personalized syncs with `ready=true`.
2. Extract one room-sync helper that sends a fresh player-specific state sync
   to every connected peer.
3. Invoke the helper after successful create/join handling and after paced bot
   actions. Do not broadcast one player's private view to another socket.
4. Preserve current action accepted, patch, and terminal ordering.

Acceptance: the creator's waiting screen unlocks when the final human joins,
without refresh, polling, or a dummy action.

## Slice 4: Client Table State and Session Creation

Files:

- `packages/web-client/src/realtime-client.ts`
- `packages/web-client/src/realtime-state.ts`
- `packages/web-client/src/client-controller.ts`
- `packages/web-client/src/browser-app.ts`
- `tests/web-client/realtime-client.test.ts`
- `tests/web-client/realtime-reducer.test.ts`
- `tests/web-client/app-controller.test.ts`

1. Add failing reducer tests for table summaries on sync and reset between
   sessions.
2. Add failing controller tests for create, reconnect, and rematch preserving
   the canonical table plan.
3. Add shared table fields to the mirrored client protocol and `ClientState`.
4. Replace the controller's positional `seatCount, bots` creation parameters
   with a creation-options object containing `gameId` and `tablePlan`. Keep any
   legacy translation at the browser entry point rather than spreading it
   through game adapters.
5. Store the last creation options for reconnect and derive rematch composition
   from the server-provided table summary, not from `Computer` name prefixes.

Acceptance: table composition survives sync, reconnect, and rematch through one
typed client interface.

## Slice 5: Mixed-Table Lobby and Waiting State

Files:

- `packages/web-client/src/templates/lobby.ts`
- `packages/web-client/src/game-adapters/labyrinth/render.ts`
- `packages/web-client/src/game-adapters/labyrinth/index.ts`
- `packages/web-client/src/game-adapters/labyrinth/game-view.tsx`
- `packages/web-client/app/app.css`
- `tests/web-client/browser-layout.test.ts`
- `tests/web-client/labyrinth-react-view.test.tsx`

1. Add failing markup tests for separate human and AI selectors, valid totals,
   and the table-composition summary.
2. Replace Labyrinth's mode cards and single player count with human and AI
   counts. Disable combinations whose total is outside two to four.
3. Submit `{ humanSeats, botSeats }` through the controller creation options.
4. Add a waiting presentation driven by `TableSummary`: show remaining humans,
   render reserved seats, and disable rotation, insertion, and movement.
5. Keep server rejection as the authority even though the client disables
   controls optimistically.
6. Preserve the existing compact desktop and mobile board bounds.

Acceptance: `2 humans + 1 AI` is explicit before creation and visibly waits for
one friend after the creator enters.

## Slice 6: Public Treasure Population and Secret Target Queue

Files:

- `packages/games/labyrinth/src/rules/labyrinth-module.ts`
- `packages/games/labyrinth/src/rules/types.ts`
- `tests/games/labyrinth/labyrinth-rules.test.ts`
- `tests/contract/labyrinth-contract.test.ts`

1. Add failing initialization tests for two, three, and four players requiring:
   - every catalog ID appears exactly once on a non-home board tile;
   - assigned targets are unique and drawn from those public treasures;
   - decoy counts are 18, 15, and 12 with the current definition;
   - identical seeds produce identical placement and target order.
2. Add a failing configuration test for a catalog larger than the available
   non-home slots.
3. Shuffle a copy of `objectiveCatalog` with the seeded game RNG. Assign the
   required target subset to player queues, then place every catalog item into
   independently shuffled eligible board slots.
4. Retain the complete ordered queue only in `LabyrinthPlayerState`.
5. Add behavior tests proving a pawn cannot collect an unassigned decoy or a
   later queue item, but collecting the queue head advances progress.
6. Change `getPlayerView().myState` to expose only `currentObjective` and
   `objectivesRemainingCount`. The public board still contains every
   `objectiveId`; it does not reveal player assignment or ordering.
7. Add contract assertions that `myState` contains no `remainingObjectives`
   field and opponent summaries contain no private target mapping.

Acceptance: all 24 treasures are plausible public destinations, while only the
server can inspect a player's later assignments.

## Slice 7: Bot and Objective UI Migration

Files:

- `packages/games/labyrinth/src/bot.ts`
- `packages/web-client/src/game-adapters/labyrinth/types.ts`
- `packages/web-client/src/game-adapters/labyrinth/game-view.tsx`
- `tests/games/labyrinth/labyrinth-bot.test.ts`
- `tests/web-client/labyrinth-react-view.test.tsx`
- `tests/e2e/self-play.test.ts`

1. Add failing bot tests using views with `currentObjective` and no future
   queue. Require objective pursuit, home return, deterministic choices, and
   no access to hidden state.
2. Update the bot's target selection to use only `currentObjective`.
3. Replace the objective list in the React view with one current-target card.
   Remove upcoming/faded cards completely.
4. Keep the local current-target beacon and coordinate treatment. When the
   target is on the spare, show that state without inventing a coordinate.
5. Add a three-player self-play roster and keep terminal completion as the
   merge gate.

Acceptance: human and bot clients can play to completion while knowing only
their current assigned treasure.

## Slice 8: Mixed Human/AI Browser Journey

Files:

- `tests/browser/games.spec.ts`
- `documentation/realtime-protocol.md`
- `documentation/labyrinth-module.md`

1. Add a browser test that creates a two-human plus one-AI table.
2. Verify the creator is blocked with `Waiting for 1 human player`, the second
   human joins the reserved seat, and both clients become ready.
3. Drive human one and human two through complete turns, then require the bot
   to complete its rotate/insert/move sequence and return control to human one.
4. Assert the board renders 24 public treasure markers and each human view
   renders exactly one private objective card with no upcoming objective UI.
5. Verify rematch keeps two human seats and one AI seat.
6. Update protocol and Labyrinth documentation with table readiness, mixed-seat
   semantics, all-treasure placement, decoys, and the redacted objective view.

Acceptance: the exact previously deadlocking composition completes a full
three-controller round in the real browser/server stack.

## Final Gates

- `npm test`
- `npm run typecheck`
- `npm run build:web`
- `npm run test:e2e`
- `/deslop` against all implementation changes
- Commit and push only after every gate passes
- Watch the automatic Cloud Run and Cloudflare Pages deployment
- Run a production browser smoke for mixed-table readiness, bot handoff, 24
  public treasures, and one private target card
