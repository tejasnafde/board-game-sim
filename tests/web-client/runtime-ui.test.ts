import { describe, expect, test } from "vitest";
import battleshipPresentation from "../../packages/games/battleship/presentation.json";
import { createWebClientRuntime } from "../../packages/web-client/src/runtime";
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

    expect(runtime.assetManager.resolveAssetUrl("tile-water")).toContain("/games/battleship/assets/tiles/water.png");
    expect(runtime.renderer.render({ phase: "setup" })).toContain("phase=setup");

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
});
