import { icon } from "../icons";

const ERROR_TEXT: Record<string, string> = {
  session_full: "Game is full",
  session_not_found: "No game with that code",
  not_your_turn: "Not your turn",
  duplicate_shot: "You already fired there",
  reverse_insertion_forbidden: "You can't push the tile back where it just came from",
  illegal_action: "That move isn't allowed right now"
};

export function humanizeError(reason: string | null | undefined): string {
  if (!reason) return "";
  return ERROR_TEXT[reason] ?? reason.replace(/_/g, " ");
}

/**
 * Deterministic rematch code: every player clicking "Play Again" derives the
 * same fresh session id from the finished one.
 */
export function nextSessionId(id: string): string {
  const match = id.match(/^(.*)-r(\d+)$/);
  return match ? `${match[1]}-r${Number(match[2]) + 1}` : `${id}-r2`;
}

/** Game-over banner that sits where the status banner was: the final board
    stays on screen instead of being wiped by a separate winner page. */
export function terminalBannerMarkup(heading: string, detailHtml = "", trophy = true): string {
  return `
    <div class="status-banner terminal-banner">
      <span class="terminal-heading">${trophy ? icon("trophy", 18) : ""} <strong>${heading}</strong></span>
      ${detailHtml ? `<span class="terminal-detail">${detailHtml}</span>` : ""}
      <span class="terminal-actions">
        <button class="btn btn-primary" id="rematch-btn">Play Again</button>
        <a class="btn btn-ghost" href="#/">Back to Hub</a>
      </span>
    </div>
  `;
}

export function lobbyPanelMarkup(
  sessionId: string,
  playerId: string,
  options: {
    title: string;
    joinLabel: string;
    hint?: string;
    error?: string | null;
    vsBot?: boolean;
    tablePlan?: { humanSeats: number; botSeats: number };
  }
): string {
  const tablePlanPicker = options.tablePlan
    ? `<fieldset class="table-plan-picker">
        <legend>Choose your table</legend>
        <div class="table-plan-fields">
          <div class="lobby-field-group">
            <label for="human-seats">Human players</label>
            <select id="human-seats">
              ${[1, 2, 3, 4].map((count) => `<option value="${count}" ${count === options.tablePlan?.humanSeats ? "selected" : ""}>${count}</option>`).join("")}
            </select>
          </div>
          <div class="lobby-field-group">
            <label for="bot-seats">Computer players</label>
            <select id="bot-seats">
              ${[0, 1, 2, 3].map((count) => `<option value="${count}" ${count === options.tablePlan?.botSeats ? "selected" : ""}>${count}</option>`).join("")}
            </select>
          </div>
        </div>
        <span class="field-hint">2–4 seats total. Game waits for every human seat; computers fill their reserved seats automatically.</span>
      </fieldset>`
    : "";

  return `
    <div class="card panel join-panel">
      <h2>${options.title}</h2>
      <div class="lobby-fields">
        <div class="lobby-field-group">
          <label for="session-id">Game Code</label>
          <div class="lobby-input-row">
            <input id="session-id" value="${sessionId}" placeholder="e.g. my-game-123" autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost" id="new-session-btn" type="button" aria-label="Generate a new random game code" title="Generate a new random game code">New</button>
          </div>
          <span class="field-hint">Share this code with a friend to play together</span>
        </div>
        <div class="lobby-field-group">
          <label for="player-id">Your Name</label>
          <input id="player-id" value="${playerId}" placeholder="e.g. alice" autocomplete="off" spellcheck="false" />
          <span class="field-hint">Any name works - just use a different one in each tab</span>
        </div>
        ${tablePlanPicker}
        ${options.vsBot
          ? `<fieldset class="game-mode-picker">
              <legend>Choose your table</legend>
              <label class="game-mode-card">
                <input type="radio" id="mode-bot" name="game-mode" value="bot" checked />
                <span class="game-mode-icon">${icon("robot", 18)}</span>
                <span class="game-mode-copy">
                  <strong>Vs Computer</strong>
                  <small>The server plays every opponent seat</small>
                </span>
                <span class="game-mode-check" aria-hidden="true">✓</span>
              </label>
              <label class="game-mode-card">
                <input type="radio" id="mode-private" name="game-mode" value="private" />
                <span class="game-mode-icon">${icon("dice", 18)}</span>
                <span class="game-mode-copy">
                  <strong>Private Table</strong>
                  <small>Friends join with your game code</small>
                </span>
                <span class="game-mode-check" aria-hidden="true">✓</span>
              </label>
            </fieldset>`
          : ""}
      </div>
      ${options.error ? `<div class="error-text lobby-error" role="alert" style="margin-top:var(--sp-3)">${humanizeError(options.error)}</div>` : ""}
      <div class="row-actions" style="margin-top:var(--sp-4)">
        <button class="btn btn-primary" id="create-btn" style="flex:1">Start game</button>
        <button class="btn btn-secondary" id="join-btn" style="flex:1">${options.joinLabel}</button>
        <button class="btn btn-ghost" id="back-home-btn">Back</button>
      </div>
      ${options.hint ? `<div class="hint">${options.hint}</div>` : ""}
    </div>
  `;
}
