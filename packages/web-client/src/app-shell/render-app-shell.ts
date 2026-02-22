import type { AppRoute } from "../routes";

export function renderAppShell(mainContent: string, route: AppRoute, sessionId: string, playerId: string): string {
  const topNav = `
    <nav class="top-nav" aria-label="Primary">
      <a class="brand" href="#/">Board Game Sim</a>
      <div class="top-nav-right">
        <span class="top-chip" title="Current session">⬡ ${sessionId}</span>
        <span class="top-chip" title="Your player identity">● ${playerId}</span>
        ${route.name === "game" ? `<button class="btn btn-ghost" id="nav-back-btn" style="padding:6px 12px;font-size:12px">← Hub</button>` : ""}
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
