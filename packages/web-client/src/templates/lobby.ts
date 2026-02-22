export function lobbyPanelMarkup(
  sessionId: string,
  playerId: string,
  options: { title: string; joinLabel: string; hint?: string }
): string {
  return `
    <div class="card panel join-panel">
      <h2>${options.title}</h2>
      <div class="lobby-fields">
        <div class="lobby-field-group">
          <label for="session-id">Session ID</label>
          <div class="lobby-input-row">
            <input id="session-id" value="${sessionId}" placeholder="e.g. my-game-123" autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost" id="new-session-btn" type="button" title="Generate a new random session ID" style="padding:0 10px;font-size:16px;">⟳</button>
          </div>
          <span class="field-hint">Share this ID with a friend to play together</span>
        </div>
        <div class="lobby-field-group">
          <label for="player-id">Your Name / ID</label>
          <input id="player-id" value="${playerId}" placeholder="e.g. player-1" autocomplete="off" spellcheck="false" />
          <span class="field-hint">Use different names in each tab (player-1, player-2…)</span>
        </div>
      </div>
      <div class="row-actions" style="margin-top:var(--sp-4)">
        <button class="btn btn-primary" id="join-btn" style="flex:1">${options.joinLabel}</button>
        <button class="btn btn-ghost" id="back-home-btn">← Back</button>
      </div>
      ${options.hint ? `<div class="hint">${options.hint}</div>` : ""}
    </div>
  `;
}
