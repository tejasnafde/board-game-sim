# Hex Kingdoms and Signal Crew Implementation Plan

## Delivery order

Build shared security and registration seams first, then Hex Kingdoms, then
Signal Crew. Every behavior change follows red-green-refactor: add the focused
test, run it and observe the expected failure, implement the smallest complete
behavior, rerun the focus set, then run the affected regression set.

Hex proves the server catalog, axial topology, hex board, card market, mixed
tables, and playtest driver. Signal then reuses the card zone and adds the more
sensitive hidden-information and cooperative-result requirements. No game is
marked playable until its rules, bot, full session runs, and browser result
screen all pass.

## Phase 1: secure session creation

### Tests first

Update `tests/contract/realtime-gateway.test.ts` and
`tests/contract/session-service.test.ts` to prove:

- an injected deterministic seed factory controls test initialization;
- production seed generation is unrelated to a public session ID;
- recovery reuses persisted metadata rather than generating another seed;
- protocol events and logs never contain the seed;
- outbound state patches never contain the canonical authoritative-state hash;
- stale and illegal actions preserve sequence and state.

Run the tests before implementation and confirm failures against the current
public-session-derived seed and canonical-hash protocol.

### Implementation

- Add `packages/server/src/session-seed.ts` with `SessionSeedFactory` and a
  production `node:crypto` implementation.
- Inject the factory at the server composition root and into
  `RealtimeGateway`; keep deterministic factories in tests.
- Persist the generated seed in existing session metadata and reuse it for
  recovery and replay.
- Remove seed values from engine initialization logs.
- Keep canonical integrity hashes in the engine and persistence layer, but
  remove them from public realtime messages. Delete unused client hash state or
  replace it only with a recipient-view hash if a demonstrated client use
  remains.
- Add a test-only server composition root for Playwright with an injected
  deterministic factory. Do not add a production environment switch for
  predictable seeds.

Verify:

```sh
npx vitest run tests/contract/realtime-gateway.test.ts tests/contract/session-service.test.ts tests/contract/ws-server.test.ts
```

## Phase 2: one authoritative server game catalog

### Tests first

Add `tests/contract/game-catalog.test.ts` for a single catalog entry supplying
the module, definition, version, seat range, and bot; engine registration and
gateway creation resolving the same entry; duplicate rejection; and absence of
registry/gateway drift.

### Implementation

- Add `packages/server/src/game-catalog.ts` with immutable built-in game
  entries and resolution.
- Make `packages/server/src/game-registration.ts` register that catalog.
- Remove the second game table from `packages/server/src/realtime-gateway.ts`.
- Export the catalog from `packages/server/src/index.ts`.
- Leave playtest scenarios outside production metadata because action caps,
  seeds, and policy mixes are test policy.

Verify:

```sh
npx vitest run tests/contract/game-catalog.test.ts tests/contract/realtime-gateway.test.ts
```

## Phase 3: shared topology and React presentation primitives

### Axial topology

Add failing `tests/shared/axial-hex.test.ts` cases for six unique clockwise
neighbors, symmetry, stable key parsing, distance laws, radius-three and
radius-four cell counts, and deterministic coordinate order.

Implement `packages/shared/src/geometry/axial-hex.ts` and export it from the
shared package. Its API contains coordinates, keys, parsing, neighbors,
distance, radius generation, and bounds only. It has no game or React terms.

### Presentation contract and runtime

Update `tests/web-client/presentation-system.test.ts` and
`tests/web-client/runtime-ui.test.ts` first for a discriminated grid, hex,
graph, and boardless union. React-owned hex and boardless presentations must
not instantiate a legacy renderer; grid regressions remain covered.

Refactor `packages/web-client/src/presentation.ts` and
`packages/web-client/src/runtime.ts`. Separate common controller/assets runtime
from the optional legacy-renderer subtype. Keep Battleship's explicit
`GridRenderer`; migrate Connect Four and Labyrinth to the React-owned path.

### Hex board

Add `tests/web-client/hex-board.test.tsx`, then implement
`packages/web-client/src/components/hex-board.tsx`. It owns projection,
responsive viewBox, stable ordering, 44-pixel targets, roving focus,
six-direction navigation, Enter/Space activation, selection and disabled
semantics, and accessible cell labels. Game content arrives through a render
slot.

### Card zone

Add `tests/web-client/card-zone.test.tsx`, then implement
`packages/web-client/src/components/card-zone.tsx`. It owns row/fan layout,
safe backs, focus, keyboard activation, selection, disabled state, and generic
content. Hidden slot keys remain opaque and never contain face identity.

Verify:

```sh
npx vitest run tests/shared/axial-hex.test.ts tests/web-client/presentation-system.test.ts tests/web-client/runtime-ui.test.ts tests/web-client/hex-board.test.tsx tests/web-client/card-zone.test.tsx
```

## Phase 4: Hex Kingdoms definition and scoring

### Package scaffold

Add the `@board-game-sim/hex-kingdoms` workspace with `definition.json`,
`presentation.json`, package metadata, exports, rule types, definition parser,
scoring, module, and bot. Add TypeScript and Vitest aliases and update the lock
file through the package manager.

### Definition tests

Create `tests/games/hex-kingdoms/hex-kingdoms-definition.test.ts` before the
parser. Cover valid count-specific layouts, 37/61 cell radii, nonoverlapping
capitals and landmarks, exactly 48 unique tiles and the exact recipe, enough
placeable cells and tiles, and rejection of malformed layouts, duplicate IDs,
unknown terrain/features, and invalid scoring values.

### Scoring tests

Create `tests/games/hex-kingdoms/hex-kingdoms-scoring.test.ts` before scoring.
Cover Crownlands connectivity and reconnection, largest province per terrain,
diversity, village distinctness and cap, keep enemy adjacency and exclusions,
shrine adjacency, unique and tied landmark pluralities, untouched landmarks,
category sums, tiebreaks, and shared winners.

Implement pure definition normalization and scoring helpers in the game
package. `projectPlacementScore` uses the same scoring path as accepted moves
so UI previews and bots cannot drift.

Verify:

```sh
npx vitest run tests/games/hex-kingdoms/hex-kingdoms-definition.test.ts tests/games/hex-kingdoms/hex-kingdoms-scoring.test.ts
```

## Phase 5: Hex Kingdoms authoritative rules and bot

### Rules tests first

Create `tests/games/hex-kingdoms/hex-kingdoms-rules.test.ts` for deterministic
setup/actions/events/hashes, seed variation, four-card market, pile redaction,
actor-only legal coordinates, all legal adjacency sources, detached
expeditions, refill, identity conservation, live-score recomputation, clockwise
turns from a seeded starter, exact 20/30/40 placement endings, winner data, and
terminal monotonicity.

Use a table of illegal actions: wrong actor, unknown action, malformed or
noninteger payload, stale/unknown market tile, out-of-arena, static occupied,
placed occupied, nonadjacent, and post-terminal. Every rejection preserves
state value, hash, events, scores, pile, market, and turn.

Implement `draft_and_place` as the only action in
`hex-kingdoms-module.ts`. Events reveal placed and newly public market tiles but
never private pile identities.

### Contract tests

Add `tests/contract/hex-kingdoms-contract.test.ts` for runtime initialization,
replay, stale sequence, immutable rejection, snapshot plus event-tail recovery,
terminal freeze, and pile redaction for every seated and unknown viewer.

### Bot tests first

Add `tests/games/hex-kingdoms/hex-kingdoms-bot.test.ts` for inactivity,
view-only inputs, visible/legal selections, reconnection, landmark swings,
province and diversity gains, feature scoring, frontier tie value, stable
stances, seeded ties, immutability, and bounded radius-four enumeration.

Implement exhaustive market-by-coordinate one-ply evaluation. Shared projected
score dominates denial, flexibility, and mild stable personality weights.

Verify:

```sh
npx vitest run tests/games/hex-kingdoms tests/contract/hex-kingdoms-contract.test.ts
```

## Phase 6: Hex Kingdoms browser experience

Before UI implementation, use the frontend design and interface-polish skills
to establish a visual direction based on a tactile map table: terrain texture,
clear wooden capitals, luminous landmarks, market tiles that read at a glance,
and restrained placement motion. Prefer original SVG and CSS assets. Any
external asset pack requires a source URL, author, license, and modification
record under the game's `assets/external` directory.

Add the manifest and adapter under:

- `packages/web-client/src/game-manifests/hex-kingdoms-manifest.ts`
- `packages/web-client/src/game-adapters/hex-kingdoms/`

Write adapter and React-view tests first for waiting tables, long names, actor
and progress status, four accessible market cards, legal-space selection,
score previews, landmark and feature explanations, pending double-submit
protection, public score breakdowns, color-independent content, unique/shared
results, rematch composition, and humanized errors.

Register Hex in the server and web catalogs only after the package, bot, and
view tests pass. The client submits only `marketTileId`, `q`, and `r`.

Verify:

```sh
npx vitest run tests/web-client/hex-board.test.tsx tests/web-client/card-zone.test.tsx tests/web-client/hex-kingdoms-adapter.test.ts tests/web-client/hex-kingdoms-react-view.test.tsx tests/web-client/registered-games.test.ts
npm run build:web
```

## Phase 7: reusable full-session driver and Hex playtests

Extract `tests/e2e/support/game-driver.ts` and a test game catalog from current
self-play. The driver gives policies only personalized views, records accepted
transcripts and actor/action counts, enforces sequence monotonicity and action
caps, serializes every view every turn, detects deadlock, and proves terminal
freeze.

Support two explicit modes:

- Synthetic all-bot creates the engine roster directly and polls every seat's
  production bot. This is the valid AI-versus-AI path because the product
  table requires at least one human.
- Product-table mode creates an explicit human/AI split, verifies waiting until
  the last human joins, lets the gateway drive reserved bots, and submits
  scripted-human intents under claimed seats.

Add Hex policies independent of its bot: province-greedy, landmark-rush,
diversity-first, and first-legal. Run every 2–4 player product split plus
all-AI sizes and recovery/concurrency cases. Require exact action count, score
recomputation, identity uniqueness, replay agreement, pile secrecy, and legal
moves before terminal.

Run 100 seeds per seat count for initial tuning. Record score distributions,
ties, seat and stance share, market-slot share, terrain/features, landmark
contention, legal-choice counts, borders, expeditions, reconnections, lead
changes, rejections, and duration. Fix invariant failures immediately; tune
definition data based on distributions rather than seed-specific branches.

## Phase 8: Signal Crew definition, knowledge, and rules

Add the `@board-game-sim/signal-crew` workspace with definition, boardless
presentation, rule types, definition parser, knowledge helpers, conservation
helpers, module, and bot. Add aliases and lockfile metadata.

### Definition and setup tests first

Cover the exact 32-packet composition, ten unique required faces, independent
deterministic mission/deck streams, varied seeds, hand sizes, bandwidth, opaque
safe IDs, and validation failures.

### Knowledge and redaction tests first

For every seat, use sentinel cards to prove own faces and deck order are absent
from views, events, errors, legal actions, diagnostics, protocol, DOM-facing
data, and unknown-viewer results. Prove teammate faces, exhaustive positive and
negative clues, stable opaque slots, reconnect perspective, and identical legal
action shape for alternate hidden faces. Explicitly prove no seed or canonical
hash crosses the wire.

### Rules tests first

Cover valid clues, correct and failed transmissions, recycling below cap, draw
and no-draw paths, relay completion and bandwidth restoration, all conservation
invariants, required-packet exhaustion, interference loss, final-orbit
boundaries, win precedence, every terminal reason, and terminal monotonicity.

Add `stand_by` as a fourth action legal only when no clue, transmission, or
recycle is legal. Test the empty-hand/zero-bandwidth final-orbit case, rejection
when a productive action exists, public event, orbit decrement, and terminal
resolution. This prevents a reachable nonterminal deadlock without allowing a
voluntary pass.

After every accepted action assert all 32 IDs exist once, each real face
remains within its owner's candidates, tracks stay bounded, sockets contain
requirements, and a current player exists unless terminal. Add randomized
reachable-state sequences across hundreds of seeds.

### Contract tests

Add `tests/contract/signal-crew-contract.test.ts` for replay, stale and illegal
actions, snapshot recovery, personalized sync, unknown viewers, error-oracle
resistance, cooperative terminal semantics, and terminal freeze.

## Phase 9: Signal Crew bot and browser experience

### Bot tests first

Cover inactivity, certain transmission before risk, actionable exhaustive
clues, safe recycling, zero-bandwidth play, calculated final-orbit risks,
stand-by only when forced, determinism, view immutability, accepted intents,
and absence of reachable deadlocks. The bot never imports or receives canonical
state.

Readable bot feedback is derived server-side from accepted public actions. Do
not accept a client-supplied reasoning string.

### UI tests and implementation

Use frontend design and interface-polish skills before implementation. Build a
compact rescue-console table with large own card backs, face-up teammate hands,
persistent knowledge chips, five legible relay cards, visible bandwidth and
interference, and focused action modes. Word, color, and symbol always identify
a channel.

Add the manifest and adapter under the matching `signal-crew` paths. Tests
cover clue previews marking every affected card, own-card secrecy in rendered
markup and accessibility output, knowledge-only socket certainty, correct and
failed feedback, relay completion, bot pacing, final orbit, cooperative win and
loss language, long names, four-player density, keyboard flow, reduced motion,
phone layout, pending actions, reconnect, and rematch.

Register Signal only after package, bot, redaction, and UI tests pass.

## Phase 10: composition matrix, browser completions, and soaks

### Gateway composition matrix

Across Battleship, Connect Four, Labyrinth, Hex Kingdoms, and Signal Crew run
all supported AI-only sizes and every product split with at least one human.
This is 42 distinct compositions: 11 canonical all-AI games and 31 product
table runs. Product pilots use personalized views; new-game pilots differ from
the production bots.

Targeted cases add creator waiting, final-human readiness, reserved bot seats,
join order, reconnect for every human, extra-join rejection, simultaneous stale
actions, off-turn actions, malformed and illegal immutable rejection, snapshot
plus event-tail recovery continued to terminal, uninterrupted/recovered result
agreement, and post-terminal rejection. Track consecutive bot moves against
the gateway's safety cap.

### Browser completions

Use DOM-visible information only. Reach the actual results screen in all five
games: Battleship, Connect Four, Labyrinth, Hex Kingdoms, and Signal Crew. Add
two-page mixed 2H/2AI terminal flows for each new game, with a midgame refresh
and rejoin. Add Signal's forced-loss run. Guard every page for console errors,
page errors, request failures, websocket rejections, and horizontal overflow.
Save start, midpoint, and terminal screenshots for the new games and terminal
screenshots for the regression games; traces and video remain failure
artifacts.

### Playtest soak

Add a sharded soak runner with profile and seed-count controls. Before handoff,
run 250 seeds for 2/3/4-player all-AI games for both new titles: 1,500 complete
games. Run all five games for ten seeds at every supported size and a smaller
mixed-policy corpus. Write deterministic ignored summaries under
`test-results/playtest`; failure transcripts contain safe actions and
personalized views, never canonical hidden state.

Signal metrics include success by seat count, loss reason, relays, clues,
transmissions, recycling, stand-bys, mistakes, bandwidth starvation, legal
choice counts, and duration. Tune for nontrivial wins and losses, varied action
use, and limited early failures. Hex metrics are defined in Phase 7.

## Phase 11: CI, documentation, review, and release

Add scripts for focused matrix and soak tiers. The normal test command includes
unit, contract, and canonical self-play. A quality workflow runs typecheck,
Vitest, the product composition matrix, web build, Chromium setup, and
Playwright before cloud authentication. Playtest soaks run manually or on a
schedule and upload summaries. Deployment depends on the full quality job.

Add per-game module documentation and update architecture, data model,
game-module contract, realtime protocol, web client, testing strategy, roadmap,
documentation index, and root README for the catalog, secure seeds, private
hashes, topology, presentation primitives, view contracts, rules, bots,
licensing, and playtest gates.

At each game milestone:

1. run focused tests and affected regressions;
2. run typecheck and production build;
3. invoke adversarial code review and resolve confirmed findings;
4. complete the repository-required deslop pass;
5. commit the coherent milestone.

Final gate:

```sh
npm run typecheck
npm test
npm run test:matrix
npm run build:web
npm run test:e2e
npm run test:soak
ALLOW_SOCKET_TESTS=1 npx vitest run tests/contract/ws-server.test.ts
git diff --check
```

Push only after the gate is green. Deploy only after both games pass the gate
and the user has not asked to keep the current environment undeployed.
