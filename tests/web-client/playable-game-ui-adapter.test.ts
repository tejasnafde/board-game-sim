import { describe, expect, test } from "vitest";
import type { JsonValue } from "@board-game-sim/shared";
import { createBattleshipUiAdapter } from "../../packages/web-client/src/game-adapters/battleship";
import { createConnect4UiAdapter } from "../../packages/web-client/src/game-adapters/connect4";
import { createLabyrinthUiAdapter } from "../../packages/web-client/src/game-adapters/labyrinth";
import {
  battleshipManifest,
  connect4Manifest,
  labyrinthManifest
} from "../../packages/web-client/src/game-manifests";
import type { ControllerTransport } from "../../packages/web-client/src/client-controller";
import type {
  ClientEvent,
  ServerEvent
} from "../../packages/web-client/src/realtime-client";
import {
  createWebClientRuntime,
  type RenderedWebClientRuntime
} from "../../packages/web-client/src/runtime";

class FakeTransport implements ControllerTransport {
  private readonly listeners: Array<(event: ServerEvent) => void> = [];

  send(_event: ClientEvent): void {}

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  emit(event: ServerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function runtimeWith(presentation: unknown, view: JsonValue): {
  runtime: RenderedWebClientRuntime;
  transport: FakeTransport;
} {
  const transport = new FakeTransport();
  const runtime = createWebClientRuntime({ presentation, baseAssetPath: "/", transport });
  runtime.controller.join("S1", "Tejas");
  transport.emit({
    type: "session.state_sync",
    sessionId: "S1",
    seq: 1,
    view,
    youAre: "player-1",
    seats: { "player-1": "Tejas" }
  });
  return { runtime, transport };
}

const renderContext = {
  confirmed: false,
  sessionId: "S1",
  playerId: "player-1",
  logs: [] as string[]
};

describe("playable-game UI adapters", () => {
  test("each adapter owns lobby screen selection behind one render interface", () => {
    const adapters = [
      createBattleshipUiAdapter(runtimeWith(battleshipManifest.presentation, { phase: "setup" }).runtime),
      createLabyrinthUiAdapter(runtimeWith(labyrinthManifest.presentation, { phase: "play" }).runtime),
      createConnect4UiAdapter(runtimeWith(connect4Manifest.presentation, { phase: "play" }).runtime)
    ];

    expect(adapters.map((adapter) => adapter.gameId)).toEqual(["battleship", "labyrinth", "connect4"]);
    expect(adapters.map((adapter) => adapter.render(renderContext))).toEqual([
      expect.stringContaining("Battleship"),
      expect.stringContaining("Labyrinth"),
      expect.stringContaining("Connect Four")
    ]);
  });
});
