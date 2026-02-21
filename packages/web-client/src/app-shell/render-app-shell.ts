import type { AppRoute } from "../routes";

export function renderAppShell(mainContent: string, route: AppRoute, sessionId: string, playerId: string): string {
  const topNav = `
    <nav class="top-nav" aria-label="Primary">
      <a class="brand" href="#/">Board Game Sim</a>
      <div class="top-nav-right">
        <span class="top-chip">Session: ${sessionId}</span>
        <span class="top-chip">Player: ${playerId}</span>
        ${route.name === "game" ? `<button class="btn btn-ghost" id="nav-back-btn">Back to games</button>` : ""}
      </div>
    </nav>
  `;

  return `
    <section class="app-shell">
      ${topNav}
      <main>${mainContent}</main>
    </section>
  `;
}
