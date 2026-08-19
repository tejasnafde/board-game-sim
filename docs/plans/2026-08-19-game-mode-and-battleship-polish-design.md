# Game Mode Clarity and Battleship Polish

## Outcome

Make the default local experience unmistakably solo against the server bot, while preserving private multiplayer tables. Bring Battleship up to the same board-first quality bar as Labyrinth and keep Connect Four visually consistent.

## Game Mode

Replace the lobby checkbox with a two-option mode selector shared by every playable game:

- **Vs Computer** is selected by default and creates server-owned seats for every opponent.
- **Private Table** creates human seats and explains that another player must join with the game code.

Labyrinth retains its total-player selector. In solo mode, every seat after the creator is assigned to a bot. The create action continues to submit intents through the existing controller; no gameplay authority moves into the browser.

## Battleship

Keep the studio-technical naval direction, but make the board feel like a physical command table:

- Render the bundled CC0 Sea Warfare ship sprites on deployment and the player's live fleet.
- Use the bundled hit and miss effects as board feedback.
- Replace the raw transport log with player-facing fleet integrity and recent-salvo information. Keep diagnostics available in a collapsed disclosure.
- Strengthen the turn header, board labels, targeting affordance, responsive layout, and terminal-state presentation.

The grid renderer receives an asset URL resolver rather than importing game assets directly. This keeps it presentation-driven and testable.

## Labyrinth and Connect Four

Labyrinth gains explicit solo/private mode selection and copy that explains bot pacing. Its existing activity feed remains the visible proof that the computer completed both stages of a turn.

Connect Four receives the same lobby behavior plus a restrained tactile board treatment. Its rules, action protocol, and bot remain unchanged.

## Assets and Licensing

Use the repository's existing OpenGameArt Sea Warfare Set first. It is CC0 and already has attribution stored beside the files. Record Kenney's CC0 Board Game Pack and Board Game Icons as approved future sources; do not add a pack unless a specific asset earns its place in a game.

## Verification

- Unit tests for default solo mode and private-table payloads.
- Renderer tests for presentation-resolved ship and effect assets.
- Browser tests proving default create claims a Computer seat in all three games.
- Battleship desktop and mobile viewport checks.
- Existing deterministic self-play, contract, typecheck, production build, and browser suites.
