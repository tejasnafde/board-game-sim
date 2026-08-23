import { lobbyPanelMarkup } from "../../templates/lobby";

export function renderHexKingdomsLobby(
  sessionId: string,
  playerId: string,
  error?: string | null
): string {
  return `
    <section class="screen hex-kingdoms-screen">
      <div class="section-head">
        <div class="hk-kicker">Territory drafting · 2–4 players</div>
        <h1>Hex Kingdoms</h1>
        <p>Draft terrain, grow a connected realm, and contest the ancient landmarks over ten decisive turns.</p>
      </div>
      ${lobbyPanelMarkup(sessionId, playerId, {
    title: "Kingdom Table",
    joinLabel: "Claim a Crown",
    error,
    tablePlan: { humanSeats: 1, botSeats: 1 }
  })}
    </section>
  `;
}
