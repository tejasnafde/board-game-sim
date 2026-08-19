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
import { createWebClientRuntime, type WebClientRuntime } from "../../packages/web-client/src/runtime";

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
  runtime: WebClientRuntime;
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

  test("Labyrinth adapter resets its ephemeral activity state between sessions", () => {
    const view = {
      phase: "play",
      turnStage: "insert",
      currentPlayerId: "player-1",
      config: { rows: 1, cols: 1, insertionIndexes: [] },
      board: [[{
        id: "tile-1",
        openings: { N: false, E: false, S: false, W: false },
        objectiveId: null
      }]],
      spareTile: {
        id: "spare",
        openings: { N: false, E: false, S: false, W: false },
        objectiveId: null
      },
      players: [{
        playerId: "player-1",
        position: { row: 0, col: 0 },
        objectivesRemainingCount: 0
      }],
      myState: {
        position: { row: 0, col: 0 },
        remainingObjectives: [],
        reachableCells: [{ row: 0, col: 0 }]
      }
    };
    const { runtime, transport } = runtimeWith(labyrinthManifest.presentation, view);
    transport.emit({
      type: "session.action_accepted",
      sessionId: "S1",
      seq: 2,
      events: [{
        eventType: "objective.collected",
        payload: { playerId: "player-1", objectiveId: "owl" }
      }]
    });
    const adapter = createLabyrinthUiAdapter(runtime);

    expect(adapter.render({ ...renderContext, confirmed: true })).toContain("collected the owl");
    adapter.resetSession();
    transport.emit({
      type: "session.action_accepted",
      sessionId: "S1",
      seq: 3,
      events: []
    });
    expect(adapter.render({ ...renderContext, confirmed: true })).not.toContain("collected the owl");
  });
});
