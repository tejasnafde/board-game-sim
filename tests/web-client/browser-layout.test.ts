import { describe, expect, test } from "vitest";
import { getGameplayPanelOrder } from "../../packages/web-client/src/browser-app";
import { renderAppShell } from "../../packages/web-client/src/app-shell";

describe("browser gameplay layout", () => {
  test("keeps debug panel before state panel", () => {
    expect(getGameplayPanelOrder()).toEqual(["debug", "state"]);
  });

  test("app shell exposes keyboard navigation and semantic session copying", () => {
    const html = renderAppShell("<p>Game</p>", { name: "game", gameId: "labyrinth" }, "S1", "P1");

    expect(html).toContain('class="skip-link"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('<button class="top-chip" id="copy-session-btn"');
  });
});
