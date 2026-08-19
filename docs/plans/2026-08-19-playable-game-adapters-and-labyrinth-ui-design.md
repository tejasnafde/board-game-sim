# Playable Game Adapters and Labyrinth UI

## Outcome

Make Labyrinth immediately playable within a laptop viewport while deepening the playable-game UI adapter seam. Preserve gameplay, protocol contracts, and server authority.

## Architecture

The browser shell owns routing, transport, session lifecycle, persisted identity, and shared chrome. Each Playable Game UI adapter owns screen selection, rendering, event binding, and ephemeral UI state for one game.

Adapters are created once per client mount. Their ephemeral state survives ordinary renders and resets at session lifecycle transitions. Registration remains outside this change except for the smallest adapter selection map needed by the shell.

## Labyrinth Interface

The maze is the visual centerpiece. The title and turn instruction share a compact header above the play area. Players, objectives, and recent activity sit in a narrow rail beside the board. The activity history no longer pushes the maze below the fold.

The presentation keeps the existing tn07 tokens and studio-technical character: neutral shell, hairline divisions, monospace metadata, and the green maze as the single saturated artifact. Motion remains short, precise, and reduced-motion safe.

## Interaction and Accessibility

- Turn status uses a polite live region.
- Rejections use an assertive alert.
- Maze cells and insertion controls have descriptive accessible names.
- The activity history is a labelled log.
- Controls retain visible focus and usable touch targets.
- Responsive sizing keeps the board usable on short and narrow viewports.

## Testing

- Adapter contract tests cover lifecycle ownership and reset behavior.
- Labyrinth markup tests cover status, board, activity, and control semantics.
- Existing unit, contract, and browser tests remain green.
- Browser verification covers desktop, narrow, hover/focus, and reduced motion.
