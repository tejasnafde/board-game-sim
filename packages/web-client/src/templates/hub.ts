import type { HubCard } from "../game-hub";

export function hubCardMarkup(card: HubCard): string {
  const isLive = card.status === "live";
  const actionLabel = isLive ? "Play now" : "Coming soon";
  return `
    <article class="card game-card ${isLive ? "" : "is-disabled"}" aria-disabled="${isLive ? "false" : "true"}">
      <div class="game-card-head">
        <h2>${card.name}</h2>
        <span class="status-pill ${isLive ? "status-live" : "status-soon"}">${
    isLive ? "Live" : "Coming soon"
  }</span>
      </div>
      <p class="game-subtitle">${card.subtitle}</p>
      <p class="release-tag">${card.releaseTag}</p>
      <div class="meta-list">
        <span>${card.players}</span>
        <span>${card.turnStyle}</span>
      </div>
      <button class="btn ${isLive ? "btn-primary" : "btn-ghost"}" data-game-id="${card.gameId}" ${
    isLive ? "" : 'disabled aria-disabled="true"'
  }>${actionLabel}</button>
    </article>
  `;
}

export function hubLandingMarkup(cardsHtml: string): string {
  return `
    <section class="screen game-hub" aria-label="Game hub">
      <header class="hero card">
        <p class="eyebrow">Board Game Sim</p>
        <h1>Choose Your Table</h1>
        <p>Play turn-based games with friends across cities from one shared command center.</p>
      </header>
      <section class="game-grid" id="game-hub-grid" aria-label="Available games">
        ${cardsHtml}
      </section>
    </section>
  `;
}
