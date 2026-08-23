import { describe, expect, test } from "vitest";
import battleshipPresentation from "../../packages/games/battleship/presentation.json";
import connect4Presentation from "../../packages/games/connect4/presentation.json";
import hexPresentation from "../../packages/games/hex-kingdoms/presentation.json";
import {
  createReactWebClientRuntime,
  createWebClientRuntime
} from "../../packages/web-client/src/runtime";
import type { ClientEvent, ServerEvent } from "../../packages/web-client/src/realtime-client";

class FakeTransport {
  public sent: ClientEvent[] = [];
  private listeners: Array<(event: ServerEvent) => void> = [];

  send(event: ClientEvent): void {
    this.sent.push(event);
  }

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((it) => it !== listener);
    };
  }

  emit(event: ServerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("web client runtime", () => {
  test("wires presentation, assets, renderer, and controller", () => {
    const transport = new FakeTransport();
    const runtime = createWebClientRuntime({
      presentation: battleshipPresentation,
      baseAssetPath: "/games/battleship",
      transport
    });

    expect(runtime.assetManager.resolveAssetUrl("tile-water")).toContain(
      "/games/battleship/assets/external/sea-warfare-set/effects/water.png"
    );
    expect(runtime.renderer?.render({ phase: "setup" })).toContain("board-root");

    runtime.controller.join("s1", "p1");
    expect(transport.sent[0]?.type).toBe("session.join");
  });

  test("reconnect sends join again via controller rejoin", () => {
    const transport = new FakeTransport();
    const runtime = createWebClientRuntime({
      presentation: battleshipPresentation,
      baseAssetPath: "/games/battleship",
      transport
    });

    runtime.controller.join("s2", "p2");
    runtime.rejoin();

    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[1]).toEqual({ type: "session.join", sessionId: "s2", playerId: "p2" });
  });

  test("lets a game module own renderer-specific visual wiring", () => {
    const runtime = createWebClientRuntime({
      presentation: battleshipPresentation,
      baseAssetPath: "/games/battleship",
      transport: new FakeTransport(),
      createRenderer: ({ presentation }) => ({
        render: () => `renderer:${presentation.gameId}`
      })
    });

    expect(runtime.renderer?.render({})).toBe("renderer:battleship");
  });

  test("creates runtimes for presentations without optional art maps", () => {
    expect(() => createWebClientRuntime({
      presentation: connect4Presentation,
      baseAssetPath: "/games/connect4",
      transport: new FakeTransport()
    })).not.toThrow();
  });

  test("creates a React-owned hex runtime without a legacy renderer", () => {
    const runtime = createReactWebClientRuntime({
      presentation: hexPresentation,
      baseAssetPath: "/games/hex-kingdoms",
      transport: new FakeTransport()
    });

    expect(runtime.presentation.board.boardType).toBe("hex");
    expect(runtime.renderer).toBeNull();
    runtime.controller.join("hex-session", "tejas");
  });
});
