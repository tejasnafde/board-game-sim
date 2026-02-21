import type { GameId } from "../routes";
import { GAME_HUB_CARDS } from "../game-hub";

export function renderComingSoon(gameId: Exclude<GameId, "battleship" | "labyrinth">): string {
  const card = GAME_HUB_CARDS.find((item) => item.gameId === gameId);
  return `
    <section class="screen coming-soon" aria-label="Coming soon">
      <article class="card panel">
        <p class="eyebrow">Roadmap</p>
        <h1>${card?.name ?? gameId} is coming soon</h1>
        <p>${card?.subtitle ?? "This module is planned for a future release."}</p>
        <button class="btn btn-primary" id="back-home-btn">Back to games</button>
      </article>
    </section>
  `;
}
