# Signal Crew Module

Signal Crew is a cooperative deduction game for two to four players. Each
crew member sees every teammate's packet faces but not their own. The crew
spends shared bandwidth on exact clues, transmits packets into matching relay
sockets, and manages interference before the reserve runs out.

## Authoritative State

The rule module owns packet faces and locations, per-player knowledge, the
reserve order, five relay requirements, bandwidth, interference, turn order,
and final-orbit state. Setup derives mission, deck, opaque packet IDs, and
starting player from independent deterministic streams. Clients submit only
`give_clue`, `transmit_packet`, `recycle_packet`, and forced `stand_by`
intents.

Packet IDs contain no face or deal-order information. Draw events publish the
recipient and opaque ID only. A packet face becomes public only when that
packet leaves a hand through transmission or recycling.

## Knowledge and Actions

A clue names one channel or rank present in a teammate's hand. It updates
every card in that hand with positive or negative information and is legal
only when it narrows at least one possibility. The server records those
possibilities so the requester sees exactly what the crew has established,
never their private face.

A matching transmission fills a relay socket. Completing both sockets repairs
the relay and restores bandwidth. A mismatch raises interference; reaching the
limit loses immediately. Recycling reveals and discards one packet to recover
bandwidth, but exhausting a packet still required by an open socket loses the
mission.

When the reserve empties, the current action starts a final orbit containing
exactly one future action per player. Terminal checks resolve restored relays
first, then overload, required-packet exhaustion, and orbit expiry.

## Player Views and Bot

Teammate hands expose faces; the requester's hand exposes opaque IDs,
candidate channels and ranks, and received clues. Unknown viewers receive only
concealed hands and no legal actions. The production bot consumes this same
player view. It combines explicit clues with public two-copy card counting,
prioritizes certain repairs, and always returns a legal fallback action.

## Browser Experience

The React adapter centers the five physical relay cards, visible teammate
signals, and the requester's encrypted packet rack. A focused action dock
guides clue, transmission, and recycle decisions without exposing canonical
state. Channel information always uses a word, shape, and color; card zones
support roving keyboard focus plus Home and End navigation. Narrow screens use
horizontal relay snapping and a reachable action dock.

## Verification

Definition, rules, illegal actions, knowledge projection, terminal precedence,
invariants, determinism, contracts, recovery, bot legality, React rendering,
browser play, and full sessions are covered. Product-table tests run every
human/computer split for two, three, and four seats. A 750-game deterministic
bot corpus checks outcome variety, mission length, and use of all three
strategic actions.
