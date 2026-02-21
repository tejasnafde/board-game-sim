export function lobbyPanelMarkup(
  sessionId: string,
  playerId: string,
  options: { title: string; joinLabel: string; hint: string }
): string {
  return `
    <section class="card panel join-panel">
      <h2>${options.title}</h2>
      <label>Session ID <input id="session-id" value="${sessionId}" /></label>
      <label>Player ID <input id="player-id" value="${playerId}" /></label>
      <div class="row-actions">
        <button class="btn btn-primary" id="join-btn">${options.joinLabel}</button>
        <button class="btn btn-ghost" id="back-home-btn">Back to games</button>
      </div>
      <p class="hint">${options.hint}</p>
    </section>
  `;
}
