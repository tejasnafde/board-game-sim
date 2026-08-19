import { lobbyPanelMarkup } from "../../templates/lobby";

export function renderConnect4Lobby(sessionId: string, playerId: string, error?: string | null): string {
  return `
    <section class="screen connect4-screen">
      <div class="section-head">
        <h1><span class="c4-disc-mini c4-p1" style="width:18px;height:18px;"></span> Connect Four</h1>
        <p>Drop discs, connect four in a row - down, across, or diagonally.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
        title: "Arcade Lobby",
        joinLabel: "Join Game",
        error,
        vsBot: true
      })}
    </section>
  `;
}
