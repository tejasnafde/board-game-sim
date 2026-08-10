import { describe, expect, test } from "vitest";
import { resolveWebsocketUrl } from "../../packages/web-client/src/bootstrap";

describe("web bootstrap", () => {
  test("uses explicit VITE_WS_URL when provided", () => {
    const wsUrl = resolveWebsocketUrl({ VITE_WS_URL: "ws://localhost:9999/realtime" }, "http://localhost:5173/");
    expect(wsUrl).toBe("ws://localhost:9999/realtime");
  });

  test("falls back to current host + /realtime with ws protocol", () => {
    const wsUrl = resolveWebsocketUrl({}, "http://127.0.0.1:5173/some/path");
    expect(wsUrl).toBe("ws://127.0.0.1:5173/realtime");
  });

  test("non-local origins without a baked url get the production backend", () => {
    // same-host fallback bricked prod when a url-less dist was deployed;
    // any deployed bundle must reach the real backend
    const wsUrl = resolveWebsocketUrl({}, "https://example.com/app");
    expect(wsUrl).toBe("wss://board-game-sim-ezvux7gqxa-el.a.run.app/realtime");
  });
});
