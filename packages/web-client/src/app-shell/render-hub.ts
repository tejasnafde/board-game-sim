import { GAME_HUB_CARDS } from "../game-hub";
import { hubCardMarkup, hubLandingMarkup } from "../templates/hub";

export function renderHubLanding(): string {
  const cardsHtml = GAME_HUB_CARDS.map(hubCardMarkup).join("");
  return hubLandingMarkup(cardsHtml);
}
