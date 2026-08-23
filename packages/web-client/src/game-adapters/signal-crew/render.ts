import { lobbyPanelMarkup } from "../../templates/lobby";

export function renderSignalCrewLobby(
  sessionId: string,
  playerId: string,
  error?: string | null
): string {
  return `
    <section class="screen signal-crew-screen">
      <div class="section-head">
        <div class="sc-kicker">Cooperative deduction · 2–4 crew</div>
        <h1>Signal Crew</h1>
        <p>You can read every packet except your own. Share exact clues, route the right signals, and repair all five relays before the final orbit expires.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Rescue Channel",
    joinLabel: "Join the Crew",
    error,
    tablePlan: { humanSeats: 1, botSeats: 1 }
  })}
    </section>
  `;
}
