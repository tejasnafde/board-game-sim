import { icon } from "../../icons";
import { lobbyPanelMarkup } from "../../templates/lobby";

export function renderLabyrinthLobby(
  sessionId: string,
  playerId: string,
  error?: string | null,
  seatCount = 2
): string {
  return `
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>${icon("maze", 24)} Labyrinth</h1>
        <p>Navigate the shifting maze. Insert the spare tile, move your pawn, collect objectives and return home to win.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Maze Lobby",
    joinLabel: "Enter Maze",
    error,
    seatCount,
    vsBot: true
  })}
    </section>
  `;
}
