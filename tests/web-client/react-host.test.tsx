import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BrowserApp } from "../../packages/web-client/src/react-app";

describe("React browser host", () => {
  test("renders the game application mount surface", () => {
    expect(renderToStaticMarkup(<BrowserApp websocketFactory={() => ({
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send() {},
      close() {}
    })} />)).toContain('data-game-client-host="react"');
  });
});
