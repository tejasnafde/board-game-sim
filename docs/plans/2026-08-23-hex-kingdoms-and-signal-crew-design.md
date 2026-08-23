# Hex Kingdoms and Signal Crew

## Outcome

Add two original, production-quality games that deepen the simulator without
turning it into a generic board-game framework.

- **Hex Kingdoms** is a competitive two-to-four-player tile-drafting game
  about growing connected realms and contesting neutral landmarks.
- **Signal Crew** is a cooperative two-to-four-player deduction game about
  routing hidden packets into exact relay sockets with limited clues.

Both games use the existing authoritative `GameModule` contract, deterministic
rules and replay, perspective-safe `GameBot` implementations, mixed human and
AI tables, complete browser experiences, and repeatable playtest telemetry.
The release gate is complete and enjoyable play, not a render-only demo.

## Architecture Direction

Three approaches were considered.

1. A universal declarative scene would model boards, cards, pieces, actions,
   and zones through one schema. It promises flexibility but would expose a
   large shallow interface and make normal game-specific UI changes into schema
   changes.
2. A shared canvas or SVG command renderer would offer visual flexibility but
   move accessibility, keyboard navigation, responsive layout, and hidden-card
   safety into every adapter.
3. Game-local rules with narrow reusable primitives retain strong ownership
   while extracting only proven repeated work.

The third approach is selected. Each game owns its definition, rules, view,
bot, scoring or knowledge model, and React adapter. Shared modules remain small
and game-agnostic:

- A server game catalog records each module, version, definition, seat range,
  and bot once, replacing duplicated registration tables.
- A pure axial-hex topology module owns coordinate keys, six deterministic
  neighbors, and distance. It knows nothing about ownership or scoring.
- An accessible React hex-board component owns axial projection, responsive
  SVG geometry, hit targets, roving focus, and keyboard movement. Hex Kingdoms
  supplies the contents and legal interactions.
- A React card-zone component owns row and fan layouts, focus, selection,
  disabled states, card aspect ratio, and safe card backs. Hex Kingdoms uses it
  for its market and Signal Crew for its asymmetric hands.

The React adapters continue to submit intents through the existing client
controller. They never patch authoritative state.

`PresentationDefinition.board` becomes a discriminated union so grid and hex
metadata do not pretend to share rows and columns. The web runtime no longer
requires a legacy string renderer for React-owned game views; Battleship keeps
its grid renderer explicitly where it is actually used.

## Server-Only Randomness

The realtime gateway currently derives a seed from the public session ID. A
client can reproduce that value, so view redaction alone cannot protect a
hidden deck.

Before Signal Crew ships, session creation receives an injected seed factory:

- Production generates a cryptographically unpredictable server-only seed.
- Tests may supply a deterministic seed factory.
- Session metadata persists the seed for snapshots, recovery, replay, and
  audits.
- State synchronization, diagnostics, client errors, and production logs never
  expose it.

This change applies to all newly created sessions and preserves deterministic
rule execution after the seed is chosen.

## Hex Kingdoms

### Experience

Hex Kingdoms uses a public market, spatial placement, and landmark competition
without captures or combat. Permanent ownership prevents destructive turns;
interaction comes from drafting denial, occupying scarce frontier cells,
building valuable borders, and changing landmark pluralities.

Pure tile laying was rejected because interaction would be mostly accidental.
Troops and conquest were rejected for version one because they add runaway
leaders, animation burden, rules weight, and a substantially larger bot search
space.

### Components and setup

- Two to four players, each with a fixed capital.
- Every player takes exactly ten turns.
- Two and three players use an axial radius-three arena with 37 cells.
- Four players use an axial radius-four arena with 61 cells.
- Count-specific capital coordinates sit at symmetric edges.
- Three symmetric neutral landmarks occupy central cells.
- Capitals and landmarks are occupied and cannot receive tiles.
- A deterministic private draw pile supplies a public four-tile market.
- The seeded starting player is stored in state.

The 48-tile recipe contains four terrains: meadow, forest, mountain, and
water. Each terrain has six plain tiles, three villages, two keeps, and one
shrine. Layouts, recipes, turn count, market size, and scoring values live in
`definition.json`; visual mappings live in `presentation.json`.

### Turn

The active player submits one atomic intent:

```ts
draft_and_place {
  marketTileId: string;
  q: number;
  r: number;
}
```

The selected tile must still be in the public market. The coordinate must be
inside the active layout, empty, and adjacent to a capital, landmark, or
placed tile. This shared-frontier rule permits detached expeditions near a
landmark, but disconnected tiles forgo Crownlands points until their owner
links them home.

The server assigns permanent ownership, removes the selected market tile,
refills from the private pile when possible, derives the public scores, and
advances clockwise. There is no passing, movement, capture, or resource phase.

### Scoring

One pure `scoreKingdom` implementation derives the live and terminal category
breakdown from the board.

- **Crownlands:** one point for every owned tile connected to the player's
  capital through owned tiles. The capital scores zero.
- **Provinces:** for each terrain, score the size of the player's largest
  contiguous owned region of that terrain.
- **Diversity:** three points for every complete set of all four terrains,
  calculated as three times the smallest terrain count.
- **Village:** one point per distinct terrain among adjacent friendly placed
  tiles, to a maximum of four. Capitals have no terrain.
- **Keep:** one point per adjacent enemy placed tile, to a maximum of three.
  Enemy capitals do not count.
- **Shrine:** four points when adjacent to at least one landmark, otherwise
  zero. Multiple landmarks do not multiply the award.
- **Landmark:** a unique positive adjacency plurality earns five points. Every
  player tied for a positive plurality earns two. An untouched landmark scores
  nothing.

The UI shows live totals and category breakdowns. Selecting a market tile and
hovering or focusing a legal cell shows the server-equivalent projected score
delta and specifically calls out landmark or feature changes. It does not
recommend moves.

### End and winner

The game ends after exactly 20, 30, or 40 accepted placements for two, three,
or four players. Winner ordering is total score, then landmark score, then the
largest single-terrain province. A remaining tie is a shared victory with no
arbitrary seat-order winner. Terminal state is monotonic.

Initialization rejects definitions whose layouts overlap, exceed their arena,
lack enough placeable cells or tiles, or contain unknown terrain or feature
values.

### View and bot

Every player sees the public board, capitals, landmarks, market, remaining-tile
count, current turn, progress, and public scoring. The private draw identities
and order never enter a player view. Only the active player receives legal
placement coordinates.

The bot consumes only that view and the static definition. It evaluates every
market-tile and legal-coordinate pair using projected score, landmark swings,
capital reconnection, province growth, diversity, market denial, and future
frontier flexibility. A stable player hash supplies a mild Architect, Warden,
or Steward preference; common score value remains dominant. Seeded randomness
breaks close ties only.

### Hex Kingdoms testing and playtesting

Focused tests cover:

- deterministic setup, actions, events, hashes, replay, and terminal scores;
- topology neighbor uniqueness and symmetry, distance properties, stable keys,
  and deterministic ordering;
- correct layouts, capital and landmark validation, and deck composition;
- every scoring category, reconnection, pluralities, ties, and tiebreaks;
- exactly one turn and one market removal per accepted action;
- identity conservation across pile, market, and board;
- immutable rejection of wrong actors, malformed intents, stale market tiles,
  invalid coordinates, occupied cells, nonadjacent cells, and terminal play;
- legal moves existing before every nonterminal turn;
- bots producing only legal intents from player views.

Named complete regression games include two contrasting two-player AI duels,
three- and four-player AI games, one human plus one or three AI players, two
humans plus one or two AI players, and four scripted humans. Scripted humans
use province-greedy, landmark-rush, diversity-first, and first-legal policies
that are independent of the production bot.

A 100-seed AI sweep runs for every seat count through the session and engine
stack. It requires terminal completion, exact action counts, no rejected bot
intents, no duplicate tiles or coordinates, recomputed score agreement, replay
hash agreement, and no draw-order leaks. Diagnostics record starting-seat win
rate, draws, margins, landmark contention, border interaction, disconnected
expeditions, and stance performance. Initial tuning bands are a draw rate below
15 percent, median winning margin from one to twelve, and no dominant starting
seat or bot stance.

Five browser games reach the result screen: one human plus one AI, one human
plus two AI, two browser humans plus one AI, two browser humans plus two AI,
and a refreshed and rejoined one-human/one-AI game. They cover readiness, turn
ownership, bot pacing, market refill, previews, double-click rejection, score
synchronization, results, rematch, responsive layouts, and console or network
errors at phone, laptop, and wide viewports.

Three-player radius-three congestion, landmark value, keep checkerboards,
detached expeditions, market luck, first-seat advantage, and analysis paralysis
remain explicit playtest questions. Tuning changes definition data before the
game version is frozen.

## Signal Crew

### Experience

Signal Crew is a cooperative packet-routing game. Players see teammates'
packets but their own cards face away. The crew uses constrained public clues
and card accounting to route exact packets into five damaged relays before
interference or time ends the mission.

A conventional sequence-building design was rejected as too close to familiar
inverse-hand games. Predicate missions were rejected because they were harder
to teach and bot reliably. Public exact-match sockets retain deduction while
adding destination choice, scarcity, relay priority, and visible progress.

### Vocabulary and components

- A **Packet** has one channel and one rank.
- A **Relay** is a public repair target with two exact **Sockets**.
- A **Clue** is truthful, exhaustive information about one attribute of a
  teammate's hand.
- Shared **Bandwidth** pays for clues.
- **Interference** records failed transmissions.
- **Recycle** reveals and discards a packet to recover bandwidth.
- **Final orbit** grants one last turn per player after the deck empties.

There are four accessible channels, each represented by word, color, and
symbol: Azure Triangle, Amber Circle, Magenta Square, and Jade Diamond. Ranks
run from one to four. Two copies of each face create 32 packets.

The mission RNG selects ten unique faces and assigns two sockets to each of
five relays. A separately shuffled complete deck deals five cards each for two
players, four for three, and three for four. Starting and maximum bandwidth is
five, six, or seven respectively. The interference limit is three. Completing
a relay restores one bandwidth up to its maximum.

Opaque card IDs are assigned after shuffling and encode no face, definition
position, or deck order. Mission and deck randomness use independently derived
deterministic streams from the persisted server seed.

### Turn actions

Each active player takes exactly one action.

**Give a clue** identifies a channel or rank on another player. It costs one
bandwidth, must match at least one card, marks every matching card, and records
the negative information on every nonmatching card. A clue never targets the
actor.

**Transmit a packet** names an opaque card in the actor's hand and an unfilled
relay socket. The packet is revealed and removed. An exact match fills the
socket; otherwise it enters the public discard and adds one interference. The
actor draws when the deck remains. Completing a relay restores bandwidth.

**Recycle a packet** is illegal at full bandwidth. It reveals and publicly
discards an owned packet, restores one bandwidth, and draws when possible.

Neither legal-action enumeration nor enabled socket controls may depend on an
actor's true hidden face. The UI may highlight a socket only when recorded
knowledge proves every remaining candidate matches it.

### Final orbit and outcomes

Drawing the final deck card schedules exactly one additional turn for every
player after the current turn. Hands shrink as packets leave them without a
replacement.

After every accepted action the server resolves, in order:

1. all ten filled sockets produce an immediate crew victory;
2. three interference produces an overload loss;
3. an unfinished required face with no remaining copy in any hand or deck
   produces an exhausted-packet loss;
4. zero final-orbit turns produces an expired-orbit loss;
5. otherwise the turn advances.

The cooperative terminal result has no individual winner. An explicit public
outcome distinguishes playing, won, and lost, while terminal reasons are
`crew_victory`, `interference_overload`, `required_packet_exhausted`, and
`final_orbit_expired`.

### Knowledge and player views

Canonical state stores full faces, deck order, hands, relay sockets, discard,
bandwidth, interference, final orbit, and per-player per-card knowledge. The
requester's own hand view contains only opaque slot IDs, possible channels,
possible ranks, and public clue markers. Teammate hands include the true face
and the same markers.

The requester’s own face must be absent from JSON paths, legal actions, events,
errors, diagnostics, DOM attributes, accessibility text, CSS classes, image
URLs, and analytics. Hidden React keys use safe opaque slot IDs. Draw events
never contain a face. Unknown or unseated viewers receive every hand concealed
or are rejected; they never receive all hands as teammates.

Events may reveal a packet only after transmission or recycling. Reconnects
reproduce the same perspective and recorded knowledge.

### Bot

The bot consumes only its personalized player view. It derives candidate faces
from recorded constraints, visible teammate hands, public discard, filled
sockets, and the known two-copy composition.

It prefers, in order: a certain transmission; a clue that makes the next
player's card certainly playable; a proven-safe recycle; a high-information
clue; a forced low-risk recycle at zero bandwidth; and a calculated
final-orbit transmission. Seeded randomness resolves equal evaluations. Its
public reasoning describes visible intent without leaking hidden faces or
private calculations.

### Signal Crew testing and playtesting

Rules and invariant tests cover deterministic and varied setup, correct hand
sizes, unique mission requirements, every successful action path, immutable
illegal-action rejection, positive and negative clue updates, card departure,
draw and no-draw paths, relay rewards, final-orbit boundaries, terminal
precedence, all terminal reasons, and replay integrity.

After every accepted action tests assert that all 32 opaque IDs exist exactly
once across deck, hands, discard, and sockets; every true face remains inside
its owner's knowledge candidates; bandwidth and interference stay bounded;
filled sockets match requirements; and the current player is valid unless the
game is terminal. Randomized action sequences exercise hundreds of seeds.

Perspective tests cover every seat and reachable phase. They use synthetic
sentinel faces to prove own faces and deck order are absent without confusing
legitimate public requirements with leaks. They also prove teammate visibility,
unknown-viewer concealment, reconnect stability, safe IDs, event redaction,
identical legal-action shape regardless of hidden face, and no rejected-action
oracle. Browser network payloads, diagnostics, DOM, and accessibility trees are
part of this gate.

Bot tests prove inactivity behavior, certain transmissions, actionable clues,
safe recycling, zero-bandwidth play, final-orbit risks, determinism, accepted
intents from the exact supplied view, and absence of nonterminal deadlocks.

Five complete seeded AI games run for each of two, three, and four seats.
Gateway/table tests cover every composition: one human and one AI; two humans;
one or two humans with remaining AI seats at three players; all humans at three;
one, two, or three humans with remaining AI seats at four; and four humans.
Automated human seats act only through their personalized view or rendered DOM.
Coverage includes join order, waiting, reconnect, stale sequences, bot pacing,
snapshot recovery, and terminal synchronization.

Six browser playthroughs reach terminal state: a normal one-human/one-AI win,
two browser humans, one human plus two AI, two humans plus one AI with reconnect,
one human plus three AI, and a forced interference loss. Screenshots and UI
assertions cover setup, first clue, correct and wrong transmission, relay
completion, final orbit, results, rematch, and mobile layout.

A 100-seed soak per seat count records victory rate, turns, relays, action mix,
interference, bandwidth starvation, early losses, terminal reasons, and repeated
states. Initial tuning targets are zero deadlocks or rejected bot actions, a
roughly 55-to-85-percent smart-bot win rate, fewer than ten percent of losses
before two relays, meaningful use of every action, and a median 20-to-35-turn
session. These are tuning signals rather than frozen contracts.

## Cross-Game Regression and Release Gate

The existing self-play suite continues to complete every released game. Before
release, automated pilots also finish at least five different games end to end:
Hex Kingdoms, Signal Crew, Battleship, Labyrinth, and Connect Four. Paddle Chip
receives regression coverage if it is still a registered playable game; a game
that cannot reliably terminate is not represented as playable.

The complete gate requires:

- type checking, linting, package tests, contract tests, randomized invariants,
  self-play, gateway tests, browser tests, and production builds;
- all supported human and AI compositions for both new games;
- seeded balance reports and qualitative notes for hesitation, downtime,
  clarity, tactical variety, and satisfying feedback;
- accessibility and responsive checks for keyboard, reduced motion, long names,
  color-independent meaning, and phone-to-wide layouts;
- repeated adversarial design and code reviews, with confirmed findings fixed
  or explicitly resolved;
- a deslop pass before each commit;
- synchronized architecture, game-module, testing, web-client, roadmap, and
  per-game documentation;
- deployment only after both games satisfy the gate and the user has not asked
  to keep the current environment undeployed.

