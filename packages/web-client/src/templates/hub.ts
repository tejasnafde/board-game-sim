import type { HubCard } from "../game-hub";
import { icon } from "../icons";

export function hubCardMarkup(card: HubCard): string {
  const isLive = card.status === "live";
  const actionLabel = isLive ? "Play now" : "Coming soon";
  const iconName =
    card.gameId === "battleship" ? "ship"
    : card.gameId === "labyrinth" ? "maze"
    : card.gameId === "connect4" ? "connect4"
    : "dice";
  return `
    <article class="card game-card ${isLive ? "" : "is-disabled"}" aria-disabled="${isLive ? "false" : "true"}">
      <div class="game-card-head">
        <h2><span style="margin-right:6px">${icon(iconName, 20)}</span>${card.name}</h2>
        <span class="status-pill ${isLive ? "status-live" : "status-soon"}">${isLive ? "Live" : "Soon"}</span>
      </div>
      <p class="game-subtitle">${card.subtitle}</p>
      <div class="meta-list">
        <span>${card.players}</span>
        <span>${card.turnStyle}</span>
      </div>
      <button class="btn ${isLive ? "btn-primary" : "btn-ghost"}" data-game-id="${card.gameId}" ${isLive ? "" : 'disabled aria-disabled="true"'
    } style="margin-top:4px;width:100%">${actionLabel}</button>
    </article>
  `;
}

export function hubLandingMarkup(cardsHtml: string): string {
  return `
    <section class="screen game-hub" aria-label="Game hub">
      <header class="hero">
        <p class="eyebrow">Board Game Sim</p>
        <h1>Choose Your Table</h1>
        <p>Play turn-based games with friends across cities from one shared command center.</p>
      </header>
      <section class="game-grid" id="game-hub-grid" aria-label="Available games">
        ${cardsHtml}
      </section>
      <p style="margin-top:var(--sp-5);font-size:11px;color:var(--ink-3);">
        Icons by <a href="https://game-icons.net" target="_blank" rel="noreferrer" style="color:inherit;">game-icons.net</a> (CC BY 3.0)
      </p>
    </section>
  `;
}
