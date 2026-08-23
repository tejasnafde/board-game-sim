# Hex Kingdoms Module

Hex Kingdoms is a competitive tile-drafting game for two to four players. Each
player drafts one visible market tile and places it on an unoccupied frontier
hex. The game lasts ten turns per player and then scores the completed map.

## Authoritative State

The rule module owns the shuffled draw pile, visible four-tile market,
capitals, neutral landmarks, placements, turn order, and live scores. Setup
uses independent deterministic tile and starter streams derived from the
private session seed. Clients submit only `draft_and_place` with a market tile
ID and axial coordinate.

The player view exposes the market, placed tiles, scores, current player, and
remaining tile count. It never exposes draw-pile identities or order. Legal
coordinates appear only in the active player's view.

## Placement and Scoring

A placement must be inside the selected seat-count layout, unoccupied, and
adjacent to a capital, landmark, or placed tile. Scoring combines:

- crownlands connected to the player's capital;
- the largest connected province of each terrain;
- complete meadow, forest, mountain, and water sets;
- village, keep, and shrine feature bonuses;
- unique or tied control around neutral landmarks.

Total score breaks ties by landmark score and then largest province. An exact
tie remains a shared victory.

## Browser Experience

The React adapter renders a pointy axial map, open market, projected score
changes, and live kingdom ledger. The reusable hex board supports mouse,
touch, focus previews, and six-direction keyboard navigation. Visuals are
procedural CSS/SVG-native assets, so no external license or image payload is
required.

## Verification

Rule, scoring, bot, contract, recovery, component, adapter, browser, and
full-session tests cover the module. Product-table tests run every human/bot
split for two, three, and four seats. Synthetic playtests use independent
policies and the production bot, including a 750-game deterministic balance
corpus.
